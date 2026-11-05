import type { SyncService } from "../domain/model";
export const sync: SyncService = {
  async run() {
    throw new Error(
      "Bản web dùng để xem giao diện và học với văn bản. Đồng bộ tài liệu dùng trên bản Android/iPhone.",
    );
  },
};
export function pendingCount(_ownerId: string) {
  return 0;
}
