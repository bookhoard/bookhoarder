import { listProfiles } from "@/lib/profiles/store";
import type { Profile } from "@/lib/profiles/types";

/**
 * The profile MCP tools act as — it owns the ratings, favorites, collections,
 * and shopping list they touch. `MCP_PROFILE_ID` picks one; without it, the
 * first admin is used (the first profile is always an admin).
 */
export async function getMcpProfile(): Promise<Profile> {
  const profiles = await listProfiles();
  const wanted = process.env.MCP_PROFILE_ID?.trim();
  if (wanted) {
    const match = profiles.find((p) => p.id === wanted);
    if (!match) {
      throw new Error(`MCP_PROFILE_ID is set to "${wanted}", but there is no profile with that id`);
    }
    return match;
  }
  return profiles.find((p) => p.role === "admin") ?? profiles[0];
}
