import { describe, expect, it } from "vitest";
import { retrieveHybrid } from "@/lib/agent/retrieval";

const hasKey = Boolean(process.env.NVIDIA_API_KEY);

describe.skipIf(!hasKey)("retrieval dense réel", () => {
  it("retrouve les horaires depuis une reformulation sans mot-clé", async () => {
    const result = await retrieveHybrid(
      "Jusqu'à quand les rames circulent-elles ?",
      "fr"
    );

    expect(result.hits[0]?.doc.id).toBe("hours");
    expect(result.hits[0]?.denseScore).toBeGreaterThan(0.2);
    expect(result.mode).toBe("hybrid");
  });

  it("garde le lexical confiant sur le prix", async () => {
    const result = await retrieveHybrid("C'est combien un trajet ?", "fr");

    expect(result.hits[0]?.doc.id).toBe("fares");
    expect(result.confident).toBe(true);
  });
});
