import type { SupplierHotel } from './types';

export const supplierA: SupplierHotel[] = [
  { hotelId: 'a1', name: 'Holtin', price: 6000, city: 'delhi', commissionPct: 10 },
  { hotelId: 'a2', name: 'Radison', price: 5900, city: 'delhi', commissionPct: 13 },
  { hotelId: 'a3', name: 'City Inn', price: 3200, city: 'delhi', commissionPct: 8 },
  { hotelId: 'a4', name: 'Sea View', price: 7500, city: 'mumbai', commissionPct: 12 },
];

export const supplierB: SupplierHotel[] = [
  { hotelId: 'b1', name: 'Holtin', price: 5340, city: 'delhi', commissionPct: 20 },
  { hotelId: 'b2', name: 'Radison', price: 6200, city: 'delhi', commissionPct: 15 },
  { hotelId: 'b3', name: 'Grand Palace', price: 8100, city: 'delhi', commissionPct: 18 },
  { hotelId: 'b4', name: 'Sea View', price: 7100, city: 'mumbai', commissionPct: 14 },
];
