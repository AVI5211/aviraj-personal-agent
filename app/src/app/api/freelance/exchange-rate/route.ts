import { NextRequest, NextResponse } from "next/server";
import { getFreelanceUsdInrRate, setFreelanceUsdInrRate } from "@/lib/settings";
import { setExchangeRateSchema } from "@/lib/validation";

export async function GET() {
  const rate = await getFreelanceUsdInrRate();
  return NextResponse.json({ rate });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = setExchangeRateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await setFreelanceUsdInrRate(parsed.data.rate);
  return NextResponse.json({ rate: parsed.data.rate });
}
