import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import { upload } from '../utils/upload.js';
import {
  createTicketPaymentOrder,
  getTicketShow,
  holdTicketSeats,
  listTicketShows,
  myTicketBookings,
  releaseTicketHold,
  updateTicketShowPoster,
  verifyTicketPayment,
} from '../controllers/ticketController.js';

const router = Router();

router.get('/shows', listTicketShows);
router.get('/shows/:id', getTicketShow);
router.put(
  '/shows/:id/poster',
  authenticate,
  authorizeRoles('admin'),
  upload.single('poster'),
  updateTicketShowPoster
);
router.get('/my-bookings', authenticate, myTicketBookings);
router.post('/shows/:id/hold', authenticate, holdTicketSeats);
router.delete('/bookings/:id/hold', authenticate, releaseTicketHold);
router.post('/bookings/:id/create-order', authenticate, createTicketPaymentOrder);
router.post('/bookings/:id/verify-payment', authenticate, verifyTicketPayment);

export default router;
