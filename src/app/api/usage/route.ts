import { fetchUsage } from "@/services/energyUsage";
import { DateTime } from "luxon";
import { Input, coerce, number, object, parse, string } from "valibot";

export const dynamic = "force-dynamic"; // defaults to auto

const APISchema = object({
  userId: string(),
  startDate: coerce(number(), Number),
  endDate: coerce(number(), Number),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  let params: Input<typeof APISchema>;

  try {
    params = parse(APISchema, Object.fromEntries(searchParams));
  } catch (e) {
    return Response.json(
      {
        message: "Passed search parameters do not match the expected schema",
      },
      {
        status: 400,
      }
    );
  }

  const data = await fetchUsage({
    userId: params.userId,
    startDate: DateTime.fromSeconds(params.startDate),
    endDate: DateTime.fromSeconds(params.endDate),
  });
  return Response.json(data);
}
