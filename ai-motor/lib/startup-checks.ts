import { assertProductionPassword } from "@/lib/auth-session";
import { ensurePlatformSchema } from "@/lib/db/platform-schema";

ensurePlatformSchema();
assertProductionPassword();
