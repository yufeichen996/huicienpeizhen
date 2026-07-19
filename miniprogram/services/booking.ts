import { orderService } from './order'
export const bookingService = {
  createOrder: orderService.createFromBookingDraft,
  listOrders: orderService.listOrders,
  getOrder: orderService.getOrder,
}
