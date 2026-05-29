/** Attribution hooks — structure only; Coach layer when real data exists. */

export interface SocialClickAttribution {
  trackingId: string;
  platform: string;
  postId?: string;
  /** Implement when social analytics are wired. */
  recordClick?(payload: { url: string; clickedAt: string }): Promise<void>;
}

export interface SiteConversionAttribution {
  trackingId: string;
  /** Implement when storefront conversion tracking is wired. */
  recordConversion?(payload: {
    orderId?: string;
    revenueCents?: number;
    convertedAt: string;
  }): Promise<void>;
}

export interface PhotoStudioCoachLayer {
  /** Future: insights from attribution + library performance. */
  enabled: false;
  summarize?(trackingIds: string[]): Promise<{ summary: string } | null>;
}

export const socialClickAttributionStub: SocialClickAttribution = {
  trackingId: "",
  platform: "instagram",
};

export const siteConversionAttributionStub: SiteConversionAttribution = {
  trackingId: "",
};

export const photoStudioCoachStub: PhotoStudioCoachLayer = {
  enabled: false,
};
