'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, LogOut, Save, User, Mail, Phone, Building2, Receipt } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { updateProfile, uploadProfilePhoto } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuthStore();
  const router = useRouter();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [gstNumber, setGstNumber] = useState(user?.gstNumber ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone);
      setGstNumber(user.gstNumber ?? '');
    }
  }, [user]);

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const res = await updateProfile({ name, phone, gstNumber });
      const updated = res.data.data;
      updateUser({ name: updated.name, phone: updated.phone, gstNumber: updated.gstNumber });
      toast({ title: 'Profile updated successfully', variant: 'success' });
    } catch {
      toast({ title: 'Failed to update profile', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploadingPhoto(true);
    try {
      const res = await uploadProfilePhoto(formData);
      updateUser({ profilePhoto: res.data.data.profilePhoto });
      toast({ title: 'Profile photo updated', variant: 'success' });
    } catch {
      toast({ title: 'Failed to upload photo', variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (!user) return null;

  return (
    <div className="page-container max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your account information and preferences.</p>
      </div>

      {/* Photo + identity card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 flex items-center gap-5">
        {/* Avatar with upload button */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center overflow-hidden ring-4 ring-brand-50">
            {user.profilePhoto ? (
              <img src={user.profilePhoto} alt="Profile" className="w-20 h-20 object-cover" />
            ) : (
              <User className="w-8 h-8 text-brand-400" />
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingPhoto}
            className="absolute -bottom-1 -right-1 w-7 h-7 bg-brand-600 hover:bg-brand-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors disabled:opacity-60"
            title="Change photo"
          >
            {uploadingPhoto ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>

        <div className="min-w-0">
          <p className="text-lg font-bold text-slate-900 truncate">{user.name}</p>
          <p className="text-sm text-slate-500 truncate">{user.email}</p>
          <Badge
            variant="outline"
            className={`mt-2 text-xs capitalize ${
              user.accountType === 'corporate'
                ? 'border-violet-300 text-violet-700 bg-violet-50'
                : 'border-brand-300 text-brand-700 bg-brand-50'
            }`}
          >
            {user.accountType === 'corporate' ? <Building2 className="w-3 h-3 mr-1 inline" /> : null}
            {user.accountType ?? 'individual'}
          </Badge>
        </div>
      </div>

      {/* Edit form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 space-y-5">
        <h2 className="font-semibold text-slate-800">Personal Information</h2>

        <div className="space-y-1.5">
          <Label htmlFor="name" className="flex items-center gap-1.5 text-sm text-slate-700">
            <User className="w-3.5 h-3.5" /> Full Name
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="flex items-center gap-1.5 text-sm text-slate-700">
            <Mail className="w-3.5 h-3.5" /> Email Address
          </Label>
          <Input
            id="email"
            value={user.email}
            disabled
            className="h-10 bg-slate-50 text-slate-500 cursor-not-allowed"
          />
          <p className="text-xs text-slate-400">Email cannot be changed.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="flex items-center gap-1.5 text-sm text-slate-700">
            <Phone className="w-3.5 h-3.5" /> Phone Number
          </Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="h-10"
          />
        </div>

        {user.accountType === 'corporate' && (
          <div className="space-y-1.5">
            <Label htmlFor="gst" className="flex items-center gap-1.5 text-sm text-slate-700">
              <Receipt className="w-3.5 h-3.5" /> GST Number
            </Label>
            <Input
              id="gst"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="GST Number"
              className="h-10"
            />
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-10 bg-brand-600 hover:bg-brand-700 text-white font-medium"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* Sign out */}
      <div className="bg-white rounded-2xl border border-red-100 p-6">
        <h2 className="font-semibold text-slate-800 mb-1">Sign Out</h2>
        <p className="text-sm text-slate-500 mb-4">You will be signed out from your account on this device.</p>
        <Button
          variant="outline"
          onClick={handleLogout}
          className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700 font-medium"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
