
import { NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const redis = getRedisClient();
    const result = await redis.ping();

    return NextResponse.json({
      status: "healthy",
      service: "redis",
      response: result,
    });
  } catch (error) {
    console.error("Redis health check failed:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        service: "redis",
        message: "Redis connection failed.",
      },
      { status: 503 },
    );
  }
}
