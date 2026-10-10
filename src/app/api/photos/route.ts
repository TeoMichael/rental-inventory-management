import { handlePhotoUpload } from "../../../lib/server/photo-upload";

export async function POST(request: Request): Promise<Response> {
  return handlePhotoUpload(request);
}
