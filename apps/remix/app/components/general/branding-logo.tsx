import LogoImage from '@documenso/assets/omp_logo_b.png';
import type { ImgHTMLAttributes } from 'react';

export type LogoProps = ImgHTMLAttributes<HTMLImageElement>;

export const BrandingLogo = ({ ...props }: LogoProps) => {
  return <img src={LogoImage} alt="Open Mic Productions" {...props} />;
};
