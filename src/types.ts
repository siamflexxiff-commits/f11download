export interface SiteConfig {
  downloads: number;
  activeUsers: number;
  version: string;
  downloadUrl: string;
  heroHeadline: string;
  heroSubtitle: string;
  discordUrl: string;
  developerName: string;
}

export const DEFAULT_CONFIG: SiteConfig = {
  downloads: 12450,
  activeUsers: 842,
  version: "v1.0.0",
  downloadUrl: "https://ais-pre-55kpxymd2xxwrxppsso5pt-75270057923.asia-east1.run.app/F11Hotkey.msi",
  heroHeadline: "Unlock your peak gaming experience.",
  heroSubtitle: "The ultimate companion for MSI and BlueStacks players. Effortlessly switch resolutions and map custom hotkeys to maximize your FPS.",
  discordUrl: "https://discord.gg/optiverseex",
  developerName: "teamquax"
};
