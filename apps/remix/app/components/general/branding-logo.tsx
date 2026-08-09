import type { ImgHTMLAttributes } from 'react';

export type LogoProps = ImgHTMLAttributes<HTMLImageElement>;

export const BrandingLogo = ({ ...props }: LogoProps) => {
  return <img src="/static/omp_logo_b.png" alt="Open Mic Productions" {...props} />;
};
