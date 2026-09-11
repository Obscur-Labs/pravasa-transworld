'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, Calendar, FileText, ExternalLink, FolderArchive, Download, Loader2, Building2, User, CheckCircle, XCircle, DollarSign, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatTile } from '@/components/ui/stat-tile';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CustomerFormDialog } from '@/components/shared/customer-form-dialog';
import { toast } from '@/components/ui/use-toast';
import { getUsers, getUserApplications, getUserVaultDocuments, downloadUserVaultZip, deleteUser } from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { User as IUser, Application, VaultDocument } from '@/types';
import { STATUS_LABELS } from '@/types';

const statusVariant = (s: string) => {
  if (s === 'visa_approved' || s === 'visa_delivered') return 'success';
  if (s === 'visa_rejected') return 'destructive';
  if (s === 'payment_pending' || s === 'submitted') return 'warning';
  return 'info';
};

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<IUser | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [vaultDocs, setVaultDocs] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!user) return;
    await deleteUser(user._id);
    toast({ title: 'Customer deleted', description: `${user.name} was moved to trash.` });
    router.push('/users');
  };

  useEffect(() => {
    Promise.all([
      getUsers().then((r) => {
        const found = (r.data.data as IUser[]).find((u) => u._id === id);
        setUser(found || null);
      }),
      getUserApplications(id).then((r) => setApplications(r.data.data)),
      getUserVaultDocuments(id).then((r) => setVaultDocs(r.data.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [id]);

  const handleDownloadVaultZip = async () => {
    setDownloadingZip(true);
    try {
      const response = await downloadUserVaultZip(id);
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vault-${user?.name?.replace(/\s+/g, '-') ?? id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', description: 'Could not create zip file.', variant: 'destructive' });
    } finally {
      setDownloadingZip(false);
    }
  };

  const { pageItems: vaultPage, paginationProps: vaultPagination } = usePagination(vaultDocs, 'customer-vault');
  const { pageItems: appPage, paginationProps: appPagination } = usePagination(applications, 'customer-applications');

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <p className="text-muted-foreground">Customer not found.</p>
      </div>
    );
  }

  const appsByStatus = applications.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  const totalSpend = applications
    .filter((a) => ['payment_completed', 'visa_processing', 'embassy_review', 'visa_approved', 'visa_delivered'].includes(a.status))
    .reduce((sum, a) => sum + (a.paymentAmount || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Customers
      </button>

      {/* Profile Header */}
      <div className="bg-card rounded-2xl border border-border p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 ${user.accountType === 'corporate' ? 'bg-warning/10' : 'bg-primary/10'}`}>
            <span className={`text-2xl font-bold ${user.accountType === 'corporate' ? 'text-warning' : 'text-primary'}`}>{user.name?.[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{user.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.isActive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
              {user.accountType === 'corporate' ? (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-warning/10 text-warning">
                  <Building2 className="w-3 h-3" /> Corporate
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                  <User className="w-3 h-3" /> Individual
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{user.email}</span>
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{user.phone}</span>
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Joined {formatDate(user.createdAt)}</span>
              {user.accountType === 'corporate' && user.gstNumber && (
                <span className="flex items-center gap-1.5 font-mono text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-md border border-warning/20">
                  GST: {user.gstNumber}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatTile label="Total Applications" value={applications.length} icon={FileText} tone="text-primary bg-primary/10" />
        <StatTile label="Visas Approved" value={appsByStatus['visa_approved'] || 0} icon={CheckCircle} tone="text-success bg-success/10" />
        <StatTile label="Rejected" value={appsByStatus['visa_rejected'] || 0} icon={XCircle} tone="text-destructive bg-destructive/10" />
        <StatTile label="Total Spend" value={formatCurrency(totalSpend)} icon={DollarSign} tone="text-info bg-info/10" />
      </div>

      {/* Vault Documents */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-muted-foreground" />
            Document Vault
            <span className="text-sm font-normal text-muted-foreground">({vaultDocs.length})</span>
          </h2>
          {vaultDocs.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleDownloadVaultZip} disabled={downloadingZip}>
              {downloadingZip ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download ZIP
            </Button>
          )}
        </div>
        {vaultDocs.length === 0 ? (
          <EmptyState icon={FolderArchive} title="No documents in vault" description="Documents this customer uploads will appear here." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {vaultPage.map((doc) => (
              <Card key={doc._id}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-sm truncate">{doc.label}</p>
                    <p className="text-xs text-muted-foreground capitalize">{doc.type.replace('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(doc.createdAt)}</p>
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors flex-shrink-0"
                    title="View document"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <Pagination {...vaultPagination} className="px-0" />
      </div>

      {/* Applications */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-muted-foreground" />
          Applied Applications
          <span className="text-sm font-normal text-muted-foreground">({applications.length})</span>
        </h2>

        {applications.length === 0 ? (
          <EmptyState icon={FileText} title="No applications yet" description="Applications submitted by this customer will appear here." />
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/40">
                  {['Application No.', 'Country & Visa', 'Amount', 'Status', 'Applied On', ''].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {appPage.map((app) => (
                  <TableRow key={app._id}>
                    <TableCell>
                      <span className="font-mono text-xs bg-muted text-foreground/80 px-2 py-0.5 rounded">
                        {app.referenceId}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {app.country?.flag && (
                          <img src={`https://flagcdn.com/w20/${app.country.flag}.png`} alt="" className="w-5 h-3 object-cover rounded flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-foreground">{app.country?.name}</p>
                          <p className="text-xs text-muted-foreground">{app.visaType?.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {app.paymentAmount ? formatCurrency(app.paymentAmount) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(app.status) as any} className="text-xs whitespace-nowrap">
                        {STATUS_LABELS[app.status] || app.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(app.createdAt)}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => router.push(`/applications/${app._id}`)}
                        className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors"
                        title="View application"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination {...appPagination} className="border-t border-border" />
          </div>
        )}
      </div>

      <CustomerFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={user}
        onSaved={(saved) => setUser(saved)}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete Customer?"
        description={`"${user.name}" will be moved to trash. Their applications and documents are kept and re-link if the customer is restored.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
