import { Img, Link } from '../components';
import { useBranding } from '../providers/branding';
import { getSafeBrandingUrl } from '../utils/branding-url';

export type TemplateBrandingLogoProps = {
  assetBaseUrl: string;
  className?: string;
};

/**
 * Renders the email logo.
 *
 * - When custom branding is enabled with a logo, the branding logo is shown.
 *   If a safe (http/https) Brand Website is configured, the logo links to it.
 * - Otherwise the Open Mic Productions logo is shown.
 */
export const TemplateBrandingLogo = ({ assetBaseUrl, className = 'mb-6 h-32 mx-auto' }: TemplateBrandingLogoProps) => {
  const branding = useBranding();

  const logoClassName = `${className} mx-auto block`;

  const hasCustomBrandingLogo = branding.brandingEnabled && Boolean(branding.brandingLogo);

  if (!hasCustomBrandingLogo) {
    const documensoLogoUrl = new URL('/static/logo.png', assetBaseUrl).toString();

    return (
      <div style={{ textAlign: 'center' }}>
        <Img
          src={documensoLogoUrl}
          alt="Open Mic Productions Logo"
          className={logoClassName}
          style={{ margin: '0 auto', display: 'block' }}
        />
      </div>
    );
  }

  const brandingLogo = (
    <Img
      src={branding.brandingLogo}
      alt="Branding Logo"
      className={logoClassName}
      style={{ margin: '0 auto', display: 'block' }}
    />
  );

  const safeBrandingUrl = getSafeBrandingUrl(branding.brandingUrl);

  if (!safeBrandingUrl) {
    return <div style={{ textAlign: 'center' }}>{brandingLogo}</div>;
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <Link href={safeBrandingUrl} target="_blank">
        {brandingLogo}
      </Link>
    </div>
  );
};

export default TemplateBrandingLogo;
