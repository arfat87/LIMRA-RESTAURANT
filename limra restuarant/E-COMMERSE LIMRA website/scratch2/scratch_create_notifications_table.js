import { spawn } from 'child_process';

const SQL_SCRIPT = `
-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type text NOT NULL, -- 'order', 'booking', 'order_status'
  item_id bigint NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow insert for all" ON public.notifications;
DROP POLICY IF EXISTS "Allow select for admins" ON public.notifications;
DROP POLICY IF EXISTS "Allow update for admins" ON public.notifications;
DROP POLICY IF EXISTS "Allow delete for admins" ON public.notifications;

-- Create policies
CREATE POLICY "Allow insert for all" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow select for admins" ON public.notifications FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Allow update for admins" ON public.notifications FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Allow delete for admins" ON public.notifications FOR DELETE TO authenticated USING (public.is_admin());

-- Create trigger function for order insert
CREATE OR REPLACE FUNCTION public.tr_on_order_insert()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (type, item_id, title, description)
  VALUES (
    'order',
    NEW.id,
    'New Order #' || NEW.order_number,
    'Order for ₹' || NEW.total_amount || ' by ' || NEW.customer_name
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for order insert
DROP TRIGGER IF EXISTS tr_order_insert_notification ON public.orders;
CREATE TRIGGER tr_order_insert_notification
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tr_on_order_insert();

-- Create trigger function for booking insert
CREATE OR REPLACE FUNCTION public.tr_on_booking_insert()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (type, item_id, title, description)
  VALUES (
    'booking',
    NEW.id,
    'New ' || initcap(NEW.type) || ' Booking',
    'Booking #' || NEW.booking_number || ' by ' || NEW.customer_name || ' for ' || COALESCE(NEW.guests::text, '—') || ' guests'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for booking insert
DROP TRIGGER IF EXISTS tr_booking_insert_notification ON public.bookings;
CREATE TRIGGER tr_booking_insert_notification
AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.tr_on_booking_insert();

-- Create trigger function for order status update
CREATE OR REPLACE FUNCTION public.tr_on_order_status_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (type, item_id, title, description)
    VALUES (
      'order_status',
      NEW.id,
      'Order #' || NEW.order_number || ' Updated',
      'Order status changed to ' || initcap(NEW.status) || ' for ' || NEW.customer_name
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for order status update
DROP TRIGGER IF EXISTS tr_order_status_update_notification ON public.orders;
CREATE TRIGGER tr_order_status_update_notification
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tr_on_order_status_update();
`.trim();

const proc = spawn('npx', [
  '-y',
  '@insforge/mcp@latest',
  '--api_key',
  'ik_799af068e8f4fb05944d04497229fe7d',
  '--api_base_url',
  'https://vb9ucr22.us-east.insforge.app'
], { shell: true });

let buffer = '';

proc.stdout.on('data', (data) => {
  const str = data.toString();
  buffer += str;
  // Try to parse JSON lines or single response
  try {
    const lines = buffer.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line.startsWith('{') && line.endsWith('}')) {
        const json = JSON.parse(line);
        if (json.id === 3) {
          console.log('=== SQL SCRIPT EXECUTION RESULT ===');
          console.log(JSON.stringify(json.result, null, 2));
          proc.kill();
          process.exit(0);
        }
      }
    }
    buffer = lines[lines.length - 1];
  } catch (e) {
    // Wait for more data
  }
});

proc.stderr.on('data', (data) => {
  const errStr = data.toString();
  if (errStr.includes('Insforge MCP server started')) {
    setTimeout(() => {
      const req = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'run-raw-sql',
          arguments: {
            query: SQL_SCRIPT
          }
        },
        id: 3
      }) + '\n';
      proc.stdin.write(req);
    }, 1000);
  }
});

proc.on('close', (code) => {
  if (buffer.trim()) {
    try {
      const json = JSON.parse(buffer.trim());
      console.log('=== FINAL BUFFER ===', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('=== RAW BUFFER ===', buffer);
    }
  }
  process.exit(0);
});
