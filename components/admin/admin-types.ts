import type { VocPeriod } from "@/lib/agent/voc";

export type Agent = {
  id: number;
  fullName: string;
  email: string;
};

export type QueueFilters = {
  search: string;
  status: string;
  priority: string;
  provider: string;
  locale: string;
  theme: string;
  line: string;
  period: VocPeriod;
};
