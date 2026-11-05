import { ShareProvider } from '@/app/share/ShareProvider';
import '@/app/share/share.css';

export default async function ({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;

  return (
    <ShareProvider slug={slug}>
      <div className="numi-share">{children}</div>
    </ShareProvider>
  );
}
