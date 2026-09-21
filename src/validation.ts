import { z } from 'zod';

const price = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Use a non-negative price with at most two decimal places')
  .transform(Number).pipe(z.number().finite().max(Number.MAX_SAFE_INTEGER / 100));

export const hotelQuerySchema = z.object({
  city: z.string().trim().min(1).max(100).transform(value => value.toLowerCase()),
  minPrice: price.optional(),
  maxPrice: price.optional(),
}).strict().refine(value => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice, {
  message: 'minPrice must be less than or equal to maxPrice',
  path: ['minPrice'],
});

export const supplierHotelsSchema = z.array(z.object({
  hotelId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  price: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER / 100),
  city: z.string().trim().min(1),
  commissionPct: z.number().min(0).max(100),
})).max(10000);
