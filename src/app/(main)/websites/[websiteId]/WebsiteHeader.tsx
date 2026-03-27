import { Icon, Row, Text } from '@umami/react-zen';
import { WebsiteShareForm } from '@/app/(main)/websites/[websiteId]/settings/WebsiteShareForm';
import { Favicon } from '@/components/common/Favicon';
import { LinkButton } from '@/components/common/LinkButton';
import { PageHeader } from '@/components/common/PageHeader';
import { useMessages, useNavigation, useWebsite } from '@/components/hooks';
import { Edit, Share } from '@/components/icons';
import { DialogButton } from '@/components/input/DialogButton';
import { ActiveUsers } from '@/components/metrics/ActiveUsers';

export function WebsiteHeader({
  showActions,
  showTitle = true,
  showBorder = true,
  marginBottom = '3',
}: {
  showActions?: boolean;
  showTitle?: boolean;
  showBorder?: boolean;
  marginBottom?: string;
}) {
  const website = useWebsite();
  const { renderUrl, pathname } = useNavigation();
  const isSettings = pathname.endsWith('/settings');

  const { formatMessage, labels } = useMessages();

  if (isSettings) {
    return null;
  }

  return (
    <PageHeader
      title={showTitle ? website.name : undefined}
      icon={showTitle ? <Favicon domain={website.domain} /> : undefined}
      titleHref={showTitle ? renderUrl(`/websites/${website.id}`, false) : undefined}
      showBorder={showBorder}
      marginBottom={marginBottom}
    >
      <Row alignItems="center" gap="6" wrap="wrap">
        {showTitle && <ActiveUsers websiteId={website.id} />}

        {showActions && (
          <Row alignItems="center" gap>
            <ShareButton websiteId={website.id} shareId={website.shareId} />
            <LinkButton href={renderUrl(`/websites/${website.id}/settings`, false)}>
              <Icon>
                <Edit />
              </Icon>
              <Text>{formatMessage(labels.edit)}</Text>
            </LinkButton>
          </Row>
        )}
      </Row>
    </PageHeader>
  );
}

const ShareButton = ({ websiteId, shareId }) => {
  const { formatMessage, labels } = useMessages();

  return (
    <DialogButton icon={<Share />} label={formatMessage(labels.share)} width="800px">
      {({ close }) => {
        return <WebsiteShareForm websiteId={websiteId} shareId={shareId} onClose={close} />;
      }}
    </DialogButton>
  );
};
