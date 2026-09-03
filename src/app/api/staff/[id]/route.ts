export {
  getStaffHandler as GET,
  updateStaffHandler as PATCH,
  deactivateStaffHandler as DELETE,
} from "@/modules/account/presentation/controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
