import { NextRequest, NextResponse } from "next/server";
import { ensureSeeded } from "@/lib/seed";
import { getOpeningBalancePaise, setOpeningBalancePaise } from "@/lib/settings";
import { openingBalanceSchema } from "@/lib/validation";

export async function GET() {
  await ensureSeeded();
  const amountPaise = await getOpeningBalancePaise();
  return NextResponse.json({ amountPaise });
}

export async function PUT(request: NextRequest) {
  await ensureSeeded();

  const body = await request.json().catch(() => null);
  const parsed = openingBalanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await setOpeningBalancePaise(parsed.data.amountPaise);
  return NextResponse.json({ amountPaise: parsed.data.amountPaise });
}
