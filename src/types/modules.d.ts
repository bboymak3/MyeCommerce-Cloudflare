declare module 'xlsx' {
  const utils: any;
  const read: any;
  const write: any;
  const writeFile: any;
  export { utils, read, write, writeFile };
}

declare module 'qrcode.react' {
  import { ComponentType } from 'react';
  interface QRCodeProps {
    value: string;
    size?: number;
    level?: 'L' | 'M' | 'Q' | 'H';
    includeMargin?: boolean;
  }
  export const QRCodeSVG: ComponentType<QRCodeProps>;
  export const QRCodeCanvas: ComponentType<QRCodeProps>;
}