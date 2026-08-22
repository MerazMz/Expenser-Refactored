import prisma from "./db";

export async function logSyncEvent(
  userId: string,
  entityType: "expense" | "account" | "settings",
  entityId: string,
  operation: "create" | "update" | "upsert" | "delete" | "delete_month",
  data: any
) {
  try {
    const event = await prisma.syncEvent.create({
      data: {
        userId,
        entityType,
        entityId,
        operation,
        data,
      },
    });
    return event.version;
  } catch (error) {
    console.error("Failed to log sync event:", error);
    return null;
  }
}

export async function getLatestSyncCursor(userId: string): Promise<number> {
  try {
    const latest = await prisma.syncEvent.findFirst({
      where: { userId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return latest?.version || 1;
  } catch (error) {
    console.error("Failed to get latest sync cursor:", error);
    return 1;
  }
}
