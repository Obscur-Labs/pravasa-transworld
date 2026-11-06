import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { BlogPost } from '@/components/public/Blog';

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <BlogPost slug={slug} />
      <Footer />
    </div>
  );
}
