export type CarouselSlideInput = {
  headline: string;
  subline?: string;
};

export type CarouselSlideResult = {
  slide_index: number;
  headline: string;
  generation_id: number;
  tracking_id: string;
  master_url: string;
  variants: Array<{ aspect: string; public_url: string }>;
};
