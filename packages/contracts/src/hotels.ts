import { z } from 'zod';

/** A hotel of the group, as `GET /api/hotels` lists it: what a scope switcher or a hotel picker needs. */
export interface HotelRef {
  /** The hotel code every tool and workflow uses, e.g. "LIS". */
  code: string;
  name: string;
  city: string;
  country: string;
  region: string;
  brand: string;
  rooms: number;
}

/**
 * The hotels a person works on (the sidebar's scope switcher). Sent with a question; the server then limits every
 * data tool to these hotels. An empty list is the whole group. At most 50 codes.
 */
export const HotelScope = z.object({ hotels: z.array(z.string().max(16)).max(50) });
export type HotelScope = z.infer<typeof HotelScope>;
