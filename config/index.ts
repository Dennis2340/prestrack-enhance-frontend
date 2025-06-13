export const config = {
  kinde: {
    clientId: process.env.KINDE_CLIENT_ID || "",
    clientSecret: process.env.KINDE_CLIENT_SECRET || "",
    issuerUrl: process.env.KINDE_ISSUER_URL || "",
    siteUrl: process.env.KINDE_SITE_URL || "",
    postLogoutRedirectUrl: process.env.KINDE_POST_LOGOUT_REDIRECT_URL || "",
    postLoginRedirectUrl: process.env.KINDE_POST_LOGIN_REDIRECT_URL || "",
  },
  database: {
    url: process.env.DATABASE_URL || "",
    directUrl: process.env.DIRECT_URL || "",
  },
  public: {
    socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || "",
    businessId: process.env.NEXT_PUBLIC_BUSINESS_ID || "safulpay-id",
    businessName: process.env.NEXT_PUBLIC_BUSINESS_NAME || "Safulpay",
    chatbotId: process.env.NEXT_PUBLIC_CHATBOT_ID || "",
  },
};

export const BUSINESS_CONFIG = {
  businessId: config.public.businessId,
  name: config.public.businessName,
  theme: {
    primaryColor: "green-600",
    hoverColor: "green-700",
  },
};

export type Config = typeof config;
