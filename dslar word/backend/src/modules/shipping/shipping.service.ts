import { getShiprocketClient } from '../../config/shiprocket';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';

export const checkServiceability = async (pincode: string, weight = 0.5) => {
  try {
    const client = await getShiprocketClient();
    const response = await client.get('/courier/serviceability/', {
      params: {
        pickup_postcode: '834001', // DSLR WORLD store pincode (Ranchi)
        delivery_postcode: pincode,
        weight,
        cod: 1,
      },
    });

    const data = response.data;
    if (!data.data?.available_courier_companies) {
      return { serviceable: false, couriers: [] };
    }

    const couriers = data.data.available_courier_companies.map((c: Record<string, unknown>) => ({
      name: c.courier_name,
      estimatedDays: c.estimated_delivery_days,
      freightCharge: c.freight_charge,
      codCharge: c.cod_charges,
    }));

    return { serviceable: true, couriers };
  } catch (error) {
    logger.error('Shiprocket serviceability check failed:', error);
    throw new ApiError(503, 'Shipping service unavailable. Please try again.');
  }
};

export const trackByTrackingId = async (trackingId: string) => {
  try {
    const client = await getShiprocketClient();
    const response = await client.get(`/courier/track/awb/${trackingId}`);
    return response.data;
  } catch (error) {
    logger.error('Shiprocket tracking failed:', error);
    throw new ApiError(503, 'Unable to fetch tracking information.');
  }
};

export const createShipment = async (orderId: string, orderDetails: {
  orderDate: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: Array<{ name: string; sku: string; quantity: number; price: number }>;
  subTotal: number;
  weight: number;
}) => {
  try {
    const client = await getShiprocketClient();
    const payload = {
      order_id: orderId,
      order_date: orderDetails.orderDate,
      pickup_location: 'DSLR WORLD Ranchi',
      channel_id: '',
      comment: 'DSLR WORLD Order',
      billing_customer_name: orderDetails.customerName,
      billing_last_name: '',
      billing_address: orderDetails.deliveryAddress.line1,
      billing_address_2: orderDetails.deliveryAddress.line2 || '',
      billing_city: orderDetails.deliveryAddress.city,
      billing_pincode: orderDetails.deliveryAddress.pincode,
      billing_state: orderDetails.deliveryAddress.state,
      billing_country: 'India',
      billing_email: orderDetails.customerEmail,
      billing_phone: orderDetails.customerPhone,
      shipping_is_billing: true,
      order_items: orderDetails.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        units: item.quantity,
        selling_price: item.price / 100, // Convert paise to rupees
        discount: 0,
        tax: 0,
        hsn: '',
      })),
      payment_method: 'Prepaid',
      shipping_charges: 0,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: 0,
      sub_total: orderDetails.subTotal / 100,
      length: 20,
      breadth: 15,
      height: 10,
      weight: orderDetails.weight,
    };

    const response = await client.post('/orders/create/adhoc', payload);
    return response.data;
  } catch (error) {
    logger.error('Shiprocket shipment creation failed:', error);
    throw new ApiError(503, 'Failed to create shipment. Contact support.');
  }
};
