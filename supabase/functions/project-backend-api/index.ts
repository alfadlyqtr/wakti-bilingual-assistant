import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Create admin client for backend operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface RequestBody {
  projectId: string;
  action: string;
  formName?: string;
  data?: Record<string, unknown>;
  id?: string;
  collection?: string;
  email?: string;
  password?: string;
  name?: string;
  sessionId?: string;
  token?: string;
}

// Simple password hashing (for site users - not WAKTI auth users)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'wakti-project-salt-v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate simple JWT-like token for site users
function generateSiteToken(projectId: string, siteUserId: string, email: string): string {
  const payload = {
    projectId,
    siteUserId,
    email,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  return btoa(JSON.stringify(payload));
}

// Verify site token
function verifySiteToken(token: string): { projectId: string; siteUserId: string; email: string } | null {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Generate order number
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || email.trim() === '') {
    return 'Email cannot be empty';
  }

  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }

  return null;
}

// Validate that project backend is enabled and origin is allowed
async function validateRequest(projectId: string, origin: string | null): Promise<{ valid: boolean; error?: string; ownerId?: string }> {
  console.log(`[project-backend-api] Validating request for project ${projectId}, origin: ${origin}`);
  
  const { data: backend, error } = await supabase
    .from('project_backends')
    .select('enabled, allowed_origins, user_id')
    .eq('project_id', projectId)
    .single();

  if (error || !backend) {
    console.log(`[project-backend-api] Backend not found or error:`, error);
    return { valid: false, error: 'Backend not enabled for this project' };
  }

  if (!backend.enabled) {
    return { valid: false, error: 'Backend is disabled' };
  }

  // Allow all origins if array is empty (development mode) or check allowed origins
  const allowedOrigins = backend.allowed_origins || [];
  if (allowedOrigins.length > 0 && !origin) {
    console.log(`[project-backend-api] Missing origin header while allowed_origins is configured`);
    return { valid: false, error: 'Origin not allowed' };
  }

  if (allowedOrigins.length > 0 && origin) {
    const isAllowed = allowedOrigins.some((allowed: string) => 
      origin === allowed || 
      origin.endsWith(allowed) || 
      allowed === '*'
    );
    
    if (!isAllowed) {
      console.log(`[project-backend-api] Origin ${origin} not in allowed list:`, allowedOrigins);
      return { valid: false, error: 'Origin not allowed' };
    }
  }

  return { valid: true, ownerId: backend.user_id };
}

// Create notification for project owner
async function createOwnerNotification(
  projectId: string,
  ownerId: string,
  type: string,
  title: string,
  message: string,
  data: Record<string, unknown> = {}
) {
  await supabase
    .from('project_notifications')
    .insert({
      project_id: projectId,
      user_id: ownerId,
      type,
      title,
      message,
      data,
    });
}

// Handle form submissions
async function handleFormSubmit(projectId: string, ownerId: string, formName: string, data: Record<string, unknown>, origin: string | null) {
  console.log(`[project-backend-api] Form submit: ${formName}`, data);

  const submittedEmail = typeof data.email === 'string' ? data.email : null;
  if (submittedEmail) {
    const emailError = validateEmail(submittedEmail);
    if (emailError) {
      throw new Error(emailError);
    }
  }
  
  const { data: result, error } = await supabase
    .from('project_form_submissions')
    .insert({
      project_id: projectId,
      user_id: ownerId,
      form_name: formName,
      data,
      origin: origin || 'unknown',
      status: 'unread',
    })
    .select('id')
    .single();

  if (error) {
    console.error(`[project-backend-api] Form submit error:`, error);
    throw new Error('Failed to save form submission');
  }

  // AUTO-CREATE BOOKING: If form is a booking form, also create a booking record
  const isBookingForm = formName.toLowerCase().includes('booking') || 
                        formName.toLowerCase().includes('appointment') ||
                        formName.toLowerCase().includes('reservation') ||
                        formName.toLowerCase().includes('حجز');
  
  if (isBookingForm) {
    console.log(`[project-backend-api] Detected booking form, auto-creating booking record`);
    
    try {
      // Extract booking info from form data
      const customerInfo = {
        name: data.name || data.fullName || data.full_name || data.customerName || data.الاسم || 'Customer',
        email: data.email || data.البريد || '',
        phone: data.phone || data.mobile || data.الهاتف || data.الجوال || '',
      };
      
      const serviceName = data.service || data.serviceName || data.service_name || data.الخدمة || formName;
      const bookingDate = data.date || data.booking_date || data.bookingDate || data.التاريخ || new Date().toISOString().split('T')[0];
      const startTime = data.time || data.start_time || data.startTime || data.الوقت || null;
      const notes = data.notes || data.message || data.الملاحظات || data.الرسالة || '';

      // Get project name for calendar entry
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();

      const projectName = project?.name || 'Project';

      // Create booking record
      const { data: booking, error: bookingError } = await supabase
        .from('project_bookings')
        .insert({
          project_id: projectId,
          owner_id: ownerId,
          service_name: serviceName,
          booking_date: bookingDate,
          start_time: startTime,
          customer_info: customerInfo,
          notes: notes,
          status: 'pending',
        })
        .select()
        .single();

      if (!bookingError && booking) {
        console.log(`[project-backend-api] Auto-created booking: ${booking.id}`);
        
        // Create calendar entry for owner
        const entryTitle = `📅 [${projectName}] ${serviceName}`;
        const entryDescription = `Customer: ${customerInfo.name}\nPhone: ${customerInfo.phone || 'N/A'}\nEmail: ${customerInfo.email || 'N/A'}${notes ? `\nNotes: ${notes}` : ''}`;

        const { data: calendarEntry } = await supabase
          .from('project_calendar_entries')
          .insert({
            project_id: projectId,
            owner_id: ownerId,
            source_type: 'booking',
            source_id: booking.id,
            title: entryTitle,
            description: entryDescription,
            entry_date: bookingDate,
            start_time: startTime,
            is_all_day: !startTime,
            color: '#4F46E5',
            metadata: { serviceName, customerInfo, formSubmissionId: result.id },
          })
          .select('id')
          .single();

        // Link booking to calendar entry
        if (calendarEntry) {
          await supabase
            .from('project_bookings')
            .update({ calendar_entry_id: calendarEntry.id })
            .eq('id', booking.id);
        }

        // Notify owner
        await createOwnerNotification(
          projectId,
          ownerId,
          'booking',
          'New Booking',
          `${serviceName} on ${bookingDate}${startTime ? ` at ${startTime}` : ''} - ${customerInfo.name}`,
          { bookingId: booking.id, formSubmissionId: result.id }
        );

        return { success: true, id: result.id, bookingId: booking.id, calendarEntryId: calendarEntry?.id };
      }
    } catch (bookingErr) {
      console.error(`[project-backend-api] Auto-booking creation failed:`, bookingErr);
      // Don't fail the form submission, just log the error
    }
  }

  return { success: true, id: result.id };
}

// Handle collection operations (CRUD)
async function handleCollection(
  method: string,
  projectId: string,
  ownerId: string,
  collectionName: string,
  data?: Record<string, unknown>,
  itemId?: string
) {
  console.log(`[project-backend-api] Collection ${method}: ${collectionName}`, { itemId, data });

  switch (method) {
    case 'GET': {
      const { data: items, error } = await supabase
        .from('project_collections')
        .select('*')
        .eq('project_id', projectId)
        .eq('collection_name', collectionName)
        .eq('status', 'active')
        .order('sort_order', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false });

      if (error) throw new Error('Failed to fetch collection');
      return { items };
    }

    case 'POST': {
      if (!data) throw new Error('Data required for create');
      
      // Auto-create schema if first item
      const { data: schemaExists } = await supabase
        .from('project_collection_schemas')
        .select('id')
        .eq('project_id', projectId)
        .eq('collection_name', collectionName)
        .single();

      if (!schemaExists) {
        // Infer schema from data
        const fields = Object.entries(data).map(([name, value]) => ({
          name,
          type: typeof value === 'number' ? 'number' : 
                typeof value === 'boolean' ? 'boolean' :
                Array.isArray(value) ? 'array' : 'text'
        }));

        await supabase
          .from('project_collection_schemas')
          .insert({
            project_id: projectId,
            user_id: ownerId,
            collection_name: collectionName,
            schema: { fields },
            display_name: collectionName.charAt(0).toUpperCase() + collectionName.slice(1),
          });
      }

      const { data: item, error } = await supabase
        .from('project_collections')
        .insert({
          project_id: projectId,
          user_id: ownerId,
          collection_name: collectionName,
          data,
        })
        .select()
        .single();

      if (error) throw new Error('Failed to create item');
      return { item };
    }

    case 'PUT': {
      if (!itemId) throw new Error('Item ID required for update');
      if (!data) throw new Error('Data required for update');

      const { data: item, error } = await supabase
        .from('project_collections')
        .update({ data, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (error) throw new Error('Failed to update item');
      return { item };
    }

    case 'DELETE': {
      if (!itemId) throw new Error('Item ID required for delete');

      const { error } = await supabase
        .from('project_collections')
        .update({ status: 'deleted' })
        .eq('id', itemId)
        .eq('project_id', projectId);

      if (error) throw new Error('Failed to delete item');
      return { success: true };
    }

    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

// Handle site user authentication
async function handleSiteAuth(action: string, projectId: string, ownerId: string, data: Record<string, unknown>) {
  console.log(`[project-backend-api] Site auth: ${action}`);

  switch (action) {
    case 'signup': {
      const { email, password, name } = data;
      if (!email || !password) throw new Error('Email and password required');

      const passwordHash = await hashPassword(password as string);

      const { data: user, error } = await supabase
        .from('project_site_users')
        .insert({
          project_id: projectId,
          owner_id: ownerId,
          email: email as string,
          password_hash: passwordHash,
          display_name: (name as string) || null,
        })
        .select('id, email, display_name, role')
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Email already registered');
        }
        throw new Error('Failed to create account');
      }

      const token = generateSiteToken(projectId, user.id, user.email);
      return { user: { id: user.id, email: user.email, name: user.display_name, role: user.role }, token };
    }

    case 'login': {
      const { email, password } = data;
      if (!email || !password) throw new Error('Email and password required');

      const passwordHash = await hashPassword(password as string);

      const { data: user, error } = await supabase
        .from('project_site_users')
        .select('id, email, display_name, status, role, permissions')
        .eq('project_id', projectId)
        .eq('email', email as string)
        .eq('password_hash', passwordHash)
        .single();

      if (error || !user) {
        throw new Error('Invalid email or password');
      }

      if (user.status !== 'active') {
        throw new Error('Account is not active');
      }

      // Update last login
      await supabase
        .from('project_site_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id)
        .eq('project_id', projectId);

      const token = generateSiteToken(projectId, user.id, user.email);
      return { user: { id: user.id, email: user.email, name: user.display_name, role: user.role, permissions: user.permissions }, token };
    }

    case 'me': {
      const { token } = data;
      if (!token) throw new Error('Token required');

      const decoded = verifySiteToken(token as string);
      if (!decoded) throw new Error('Invalid or expired token');

      const { data: user, error } = await supabase
        .from('project_site_users')
        .select('id, email, display_name, metadata, role, permissions')
        .eq('id', decoded.siteUserId)
        .eq('project_id', projectId)
        .single();

      if (error || !user) throw new Error('User not found');

      return { user: { id: user.id, email: user.email, name: user.display_name, metadata: user.metadata, role: user.role, permissions: user.permissions } };
    }

    default:
      throw new Error(`Unknown auth action: ${action}`);
  }
}

// Handle cart operations
async function handleCart(action: string, projectId: string, ownerId: string, data: Record<string, unknown>) {
  console.log(`[project-backend-api] Cart: ${action}`, data);

  const siteUserId = data.siteUserId as string | undefined;
  const sessionId = data.sessionId as string | undefined;

  // Get or create cart
  async function getOrCreateCart() {
    const query = supabase
      .from('project_carts')
      .select('*')
      .eq('project_id', projectId);

    if (siteUserId) {
      query.eq('site_user_id', siteUserId);
    } else if (sessionId) {
      query.eq('session_id', sessionId);
    } else {
      throw new Error('siteUserId or sessionId required');
    }

    const { data: existingCart } = await query.single();

    if (existingCart) return existingCart;

    // Create new cart
    const { data: newCart, error } = await supabase
      .from('project_carts')
      .insert({
        project_id: projectId,
        site_user_id: siteUserId || null,
        session_id: sessionId || null,
        items: [],
      })
      .select()
      .single();

    if (error) throw new Error('Failed to create cart');
    return newCart;
  }

  switch (action) {
    case 'get': {
      const cart = await getOrCreateCart();
      return { cart };
    }

    case 'add': {
      const cart = await getOrCreateCart();
      const item = data.item as Record<string, unknown>;
      if (!item) throw new Error('Item required');

      const items = [...(cart.items as unknown[]), { ...item, addedAt: new Date().toISOString() }];

      const { data: updatedCart, error } = await supabase
        .from('project_carts')
        .update({ items, updated_at: new Date().toISOString() })
        .eq('id', cart.id)
        .select()
        .single();

      if (error) throw new Error('Failed to add to cart');
      return { cart: updatedCart };
    }

    case 'remove': {
      const cart = await getOrCreateCart();
      const itemIndex = data.itemIndex as number;
      const itemId = data.itemId as string;

      let items = cart.items as unknown[];
      
      if (typeof itemIndex === 'number') {
        items = items.filter((_, i) => i !== itemIndex);
      } else if (itemId) {
        items = items.filter((item: any) => item.id !== itemId);
      } else {
        throw new Error('itemIndex or itemId required');
      }

      const { data: updatedCart, error } = await supabase
        .from('project_carts')
        .update({ items, updated_at: new Date().toISOString() })
        .eq('id', cart.id)
        .select()
        .single();

      if (error) throw new Error('Failed to remove from cart');
      return { cart: updatedCart };
    }

    case 'update': {
      const cart = await getOrCreateCart();
      const itemIndex = data.itemIndex as number;
      const updates = data.updates as Record<string, unknown>;

      if (typeof itemIndex !== 'number') throw new Error('itemIndex required');
      if (!updates) throw new Error('updates required');

      const items = cart.items as any[];
      if (itemIndex >= 0 && itemIndex < items.length) {
        items[itemIndex] = { ...items[itemIndex], ...updates };
      }

      const { data: updatedCart, error } = await supabase
        .from('project_carts')
        .update({ items, updated_at: new Date().toISOString() })
        .eq('id', cart.id)
        .select()
        .single();

      if (error) throw new Error('Failed to update cart');
      return { cart: updatedCart };
    }

    case 'clear': {
      const cart = await getOrCreateCart();

      const { data: updatedCart, error } = await supabase
        .from('project_carts')
        .update({ items: [], updated_at: new Date().toISOString() })
        .eq('id', cart.id)
        .select()
        .single();

      if (error) throw new Error('Failed to clear cart');
      return { cart: updatedCart };
    }

    default:
      throw new Error(`Unknown cart action: ${action}`);
  }
}

// Handle order operations
async function handleOrder(action: string, projectId: string, ownerId: string, data: Record<string, unknown>) {
  console.log(`[project-backend-api] Order: ${action}`, data);

  switch (action) {
    case 'create': {
      const { items, buyerInfo, siteUserId, sessionId, notes, totalAmount } = data;
      
      if (!items || !buyerInfo) throw new Error('items and buyerInfo required');

      const orderNumber = generateOrderNumber();

      const { data: order, error } = await supabase
        .from('project_orders')
        .insert({
          project_id: projectId,
          owner_id: ownerId,
          site_user_id: siteUserId || null,
          order_number: orderNumber,
          items,
          buyer_info: buyerInfo,
          total_amount: totalAmount || null,
          notes: notes || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw new Error('Failed to create order');

      // Clear cart if exists
      if (siteUserId || sessionId) {
        const query = supabase
          .from('project_carts')
          .update({ items: [], updated_at: new Date().toISOString() })
          .eq('project_id', projectId);

        if (siteUserId) {
          query.eq('site_user_id', siteUserId);
        } else {
          query.eq('session_id', sessionId);
        }
        await query;
      }

      // Notify owner
      const buyer = buyerInfo as any;
      await createOwnerNotification(
        projectId,
        ownerId,
        'order',
        'New Order Received',
        `Order ${orderNumber} from ${buyer.name || buyer.email || 'Customer'}`,
        { orderId: order.id, orderNumber, buyerInfo }
      );

      // Decrement inventory if tracking enabled
      const orderItems = items as any[];
      for (const item of orderItems) {
        if (item.collectionItemId) {
          await supabase.rpc('decrement_inventory', {
            p_project_id: projectId,
            p_item_id: item.collectionItemId,
            p_quantity: item.quantity || 1,
          }).catch(() => {
            // Ignore if no inventory tracking
          });
        }
      }

      return { order };
    }

    case 'list': {
      const { status, limit = 50 } = data;
      
      let query = supabase
        .from('project_orders')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit as number);

      if (status) {
        query = query.eq('status', status);
      }

      const { data: orders, error } = await query;

      if (error) throw new Error('Failed to fetch orders');
      return { orders };
    }

    case 'get': {
      const { orderId } = data;
      if (!orderId) throw new Error('orderId required');

      const { data: order, error } = await supabase
        .from('project_orders')
        .select('*')
        .eq('id', orderId)
        .eq('project_id', projectId)
        .single();

      if (error) throw new Error('Order not found');
      return { order };
    }

    case 'update': {
      const { orderId, status, notes } = data;
      if (!orderId) throw new Error('orderId required');

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;

      const { data: order, error } = await supabase
        .from('project_orders')
        .update(updates)
        .eq('id', orderId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (error) throw new Error('Failed to update order');
      return { order };
    }

    default:
      throw new Error(`Unknown order action: ${action}`);
  }
}

// Handle inventory operations
async function handleInventory(action: string, projectId: string, ownerId: string, data: Record<string, unknown>) {
  console.log(`[project-backend-api] Inventory: ${action}`, data);

  switch (action) {
    case 'check': {
      const { itemId, itemIds } = data;
      
      let query = supabase
        .from('project_inventory')
        .select('*')
        .eq('project_id', projectId);

      if (itemId) {
        query = query.eq('collection_item_id', itemId);
      } else if (itemIds) {
        query = query.in('collection_item_id', itemIds as string[]);
      }

      const { data: inventory, error } = await query;

      if (error) throw new Error('Failed to check inventory');
      return { inventory };
    }

    case 'set': {
      const { itemId, collectionName, quantity, lowStockThreshold, trackInventory } = data;
      if (!itemId) throw new Error('itemId required');

      const { data: inventory, error } = await supabase
        .from('project_inventory')
        .upsert({
          project_id: projectId,
          collection_item_id: itemId,
          collection_name: collectionName || 'products',
          stock_quantity: quantity ?? 0,
          low_stock_threshold: lowStockThreshold ?? 5,
          track_inventory: trackInventory ?? true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'project_id,collection_item_id',
        })
        .select()
        .single();

      if (error) throw new Error('Failed to set inventory');
      return { inventory };
    }

    case 'adjust': {
      const { itemId, delta } = data;
      if (!itemId || delta === undefined) throw new Error('itemId and delta required');

      const { data: current } = await supabase
        .from('project_inventory')
        .select('stock_quantity')
        .eq('project_id', projectId)
        .eq('collection_item_id', itemId)
        .single();

      const newQuantity = Math.max(0, (current?.stock_quantity || 0) + (delta as number));

      const { data: inventory, error } = await supabase
        .from('project_inventory')
        .update({ stock_quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq('project_id', projectId)
        .eq('collection_item_id', itemId)
        .select()
        .single();

      if (error) throw new Error('Failed to adjust inventory');
      return { inventory };
    }

    default:
      throw new Error(`Unknown inventory action: ${action}`);
  }
}

// Handle booking operations with WAKTI calendar sync (uses project_calendar_entries, NOT maw3d_events)
async function handleBooking(action: string, projectId: string, ownerId: string, data: Record<string, unknown>) {
  console.log(`[project-backend-api] Booking: ${action}`, data);

  switch (action) {
    case 'check': {
      const { date, startTime, endTime } = data;
      if (!date) throw new Error('date required');

      // Check project_calendar_entries for conflicts (owner's calendar entries from projects)
      const { data: existingCalendarEntries } = await supabase
        .from('project_calendar_entries')
        .select('id, title, start_time, end_time, entry_date')
        .eq('project_id', projectId)
        .eq('owner_id', ownerId)
        .eq('entry_date', date);

      // Check project_bookings too
      const { data: existingBookings } = await supabase
        .from('project_bookings')
        .select('id, service_name, start_time, end_time, booking_date, status')
        .eq('project_id', projectId)
        .eq('booking_date', date)
        .neq('status', 'cancelled');

      // Check for conflicts if time specified
      let conflicts: any[] = [];
      if (startTime && endTime) {
        const checkStart = startTime as string;
        const checkEnd = endTime as string;

        conflicts = [
          ...(existingCalendarEntries || []).filter((e: any) => {
            if (!e.start_time || !e.end_time) return false;
            return !(checkEnd <= e.start_time || checkStart >= e.end_time);
          }),
          ...(existingBookings || []).filter((b: any) => {
            if (!b.start_time || !b.end_time) return false;
            return !(checkEnd <= b.start_time || checkStart >= b.end_time);
          }),
        ];
      }

      return {
        available: conflicts.length === 0,
        conflicts,
        existingCalendarEntries: existingCalendarEntries || [],
        existingBookings: existingBookings || [],
      };
    }

    case 'create': {
      const { serviceName, date, startTime, endTime, duration, customerInfo, siteUserId, notes } = data;
      
      if (!serviceName || !date || !customerInfo) {
        throw new Error('serviceName, date, and customerInfo required');
      }

      const customer = customerInfo as any;

      // Get project name for calendar entry
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();

      const projectName = project?.name || 'Project';

      // Create booking record
      const { data: booking, error: bookingError } = await supabase
        .from('project_bookings')
        .insert({
          project_id: projectId,
          owner_id: ownerId,
          site_user_id: siteUserId || null,
          service_name: serviceName,
          booking_date: date,
          start_time: startTime || null,
          end_time: endTime || null,
          duration_minutes: duration || null,
          customer_info: customerInfo,
          notes: notes || null,
          status: 'pending',
        })
        .select()
        .single();

      if (bookingError) throw new Error('Failed to create booking');

      // Create project_calendar_entry for owner's WAKTI calendar (NOT maw3d_events)
      const entryTitle = `📅 [${projectName}] ${serviceName}`;
      const entryDescription = `Customer: ${customer.name || 'N/A'}\nPhone: ${customer.phone || 'N/A'}\nEmail: ${customer.email || 'N/A'}${notes ? `\nNotes: ${notes}` : ''}`;

      const { data: calendarEntry, error: entryError } = await supabase
        .from('project_calendar_entries')
        .insert({
          project_id: projectId,
          owner_id: ownerId,
          source_type: 'booking',
          source_id: booking.id,
          title: entryTitle,
          description: entryDescription,
          entry_date: date,
          start_time: startTime || null,
          end_time: endTime || null,
          is_all_day: !startTime,
          color: '#4F46E5', // Indigo for bookings
          metadata: { serviceName, customerInfo },
        })
        .select('id')
        .single();

      // Link booking to calendar entry
      if (calendarEntry && !entryError) {
        await supabase
          .from('project_bookings')
          .update({ calendar_entry_id: calendarEntry.id })
          .eq('id', booking.id);

        booking.calendar_entry_id = calendarEntry.id;
      }

      // Notify owner
      await createOwnerNotification(
        projectId,
        ownerId,
        'booking',
        'New Booking',
        `${serviceName} on ${date}${startTime ? ` at ${startTime}` : ''} - ${customer.name || customer.email || 'Customer'}`,
        { bookingId: booking.id, serviceName, date, startTime, customerInfo }
      );

      return { booking, calendarEntryId: calendarEntry?.id };
    }

    case 'list': {
      const { status, fromDate, toDate, limit = 50 } = data;

      let query = supabase
        .from('project_bookings')
        .select('*')
        .eq('project_id', projectId)
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(limit as number);

      if (status) query = query.eq('status', status);
      if (fromDate) query = query.gte('booking_date', fromDate);
      if (toDate) query = query.lte('booking_date', toDate);

      const { data: bookings, error } = await query;

      if (error) throw new Error('Failed to fetch bookings');
      return { bookings };
    }

    case 'update': {
      const { bookingId, status, notes } = data;
      if (!bookingId) throw new Error('bookingId required');

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;

      // Get current booking to find linked calendar entry
      const { data: currentBooking } = await supabase
        .from('project_bookings')
        .select('calendar_entry_id, service_name')
        .eq('id', bookingId)
        .eq('project_id', projectId)
        .single();

      const { data: booking, error } = await supabase
        .from('project_bookings')
        .update(updates)
        .eq('id', bookingId)
        .eq('project_id', projectId)
        .select()
        .single();

      if (error) throw new Error('Failed to update booking');

      // Update calendar entry if status changed to cancelled
      if (status === 'cancelled' && currentBooking?.calendar_entry_id) {
        await supabase
          .from('project_calendar_entries')
          .update({ 
            title: `❌ CANCELLED: ${currentBooking.service_name}`,
            color: '#6B7280', // Gray for cancelled
          })
          .eq('id', currentBooking.calendar_entry_id)
          .eq('project_id', projectId)
          .eq('owner_id', ownerId);
      }

      return { booking };
    }

    default:
      throw new Error(`Unknown booking action: ${action}`);
  }
}

// Handle chat room operations
async function handleChat(action: string, projectId: string, ownerId: string, data: Record<string, unknown>) {
  console.log(`[project-backend-api] Chat: ${action}`, data);

  switch (action) {
    case 'rooms': {
      const { siteUserId } = data;

      let query = supabase
        .from('project_chat_rooms')
        .select('*')
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });

      // If site user, filter to rooms they're in
      if (siteUserId) {
        query = query.contains('participants', [siteUserId]);
      }

      const { data: rooms, error } = await query;

      if (error) throw new Error('Failed to fetch chat rooms');
      return { rooms };
    }

    case 'createRoom': {
      const { name, type, participants } = data;

      const { data: room, error } = await supabase
        .from('project_chat_rooms')
        .insert({
          project_id: projectId,
          name: name || null,
          type: type || 'direct',
          participants: participants || [],
        })
        .select()
        .single();

      if (error) throw new Error('Failed to create chat room');
      return { room };
    }

    case 'messages': {
      const { roomId, limit = 50, before } = data;
      if (!roomId) throw new Error('roomId required');

      let query = supabase
        .from('project_chat_messages')
        .select('*')
        .eq('project_id', projectId)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(limit as number);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data: messages, error } = await query;

      if (error) throw new Error('Failed to fetch messages');
      return { messages: messages?.reverse() || [] };
    }

    case 'send': {
      const { roomId, senderId, content, messageType } = data;
      if (!roomId || !content) throw new Error('roomId and content required');

      const { data: message, error } = await supabase
        .from('project_chat_messages')
        .insert({
          project_id: projectId,
          room_id: roomId,
          sender_id: senderId || null,
          content,
          message_type: messageType || 'text',
        })
        .select()
        .single();

      if (error) throw new Error('Failed to send message');

      // Update room's updated_at
      await supabase
        .from('project_chat_rooms')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', roomId)
        .eq('project_id', projectId);

      return { message };
    }

    default:
      throw new Error(`Unknown chat action: ${action}`);
  }
}

// Handle comment operations
async function handleComments(action: string, projectId: string, ownerId: string, data: Record<string, unknown>) {
  console.log(`[project-backend-api] Comments: ${action}`, data);

  switch (action) {
    case 'list': {
      const { itemType, itemId, limit = 50 } = data;
      if (!itemType || !itemId) throw new Error('itemType and itemId required');

      const { data: comments, error } = await supabase
        .from('project_comments')
        .select('*')
        .eq('project_id', projectId)
        .eq('item_type', itemType)
        .eq('item_id', itemId)
        .order('created_at', { ascending: true })
        .limit(limit as number);

      if (error) throw new Error('Failed to fetch comments');
      return { comments };
    }

    case 'add': {
      const { itemType, itemId, content, siteUserId, authorName, parentId } = data;
      if (!itemType || !itemId || !content) throw new Error('itemType, itemId, and content required');

      const { data: comment, error } = await supabase
        .from('project_comments')
        .insert({
          project_id: projectId,
          item_type: itemType,
          item_id: itemId,
          content,
          site_user_id: siteUserId || null,
          author_name: authorName || null,
          parent_id: parentId || null,
        })
        .select()
        .single();

      if (error) throw new Error('Failed to add comment');
      return { comment };
    }

    case 'delete': {
      const { commentId } = data;
      if (!commentId) throw new Error('commentId required');

      const { error } = await supabase
        .from('project_comments')
        .delete()
        .eq('id', commentId)
        .eq('project_id', projectId);

      if (error) throw new Error('Failed to delete comment');
      return { success: true };
    }

    default:
      throw new Error(`Unknown comments action: ${action}`);
  }
}

// Handle FreePik stock media search (images and videos)
const FREEPIK_API_KEY = Deno.env.get('FREEPIK_API_KEY') || 'FPSX97f81d1b76ea19976ac068b75e93ea9d';

async function handleFreepik(action: string, _projectId: string, _ownerId: string, data: Record<string, unknown>) {
  console.log(`[project-backend-api] Freepik: ${action}`, data);

  const headers = {
    'x-freepik-api-key': FREEPIK_API_KEY,
    'Accept': 'application/json',
  };

  switch (action) {
    case 'images': {
      // Search for images/photos/vectors
      const { query, page = 1, limit = 20, filters } = data;
      if (!query) throw new Error('query required');

      const params = new URLSearchParams({
        term: query as string,
        page: String(page),
        limit: String(Math.min(limit as number, 100)),
      });

      // Add optional filters
      if (filters) {
        const f = filters as Record<string, string>;
        if (f.type) params.append('filters[content_type][photo]', f.type === 'photo' ? '1' : '0');
        if (f.orientation) params.append('filters[orientation]', f.orientation);
        if (f.color) params.append('filters[color]', f.color);
      }

      const response = await fetch(`https://api.freepik.com/v1/resources?${params}`, { headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Freepik] Images search error:`, errorText);
        throw new Error(`Freepik API error: ${response.status}`);
      }

      const result = await response.json();
      
      // Transform to simpler format for AI - using correct API response structure
      // API returns: item.image.source.url (not source_url)
      const images = (result.data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        url: item.image?.source?.url || item.image?.source_url || '',
        thumbnail: item.image?.source?.url || '',
        size: item.image?.source?.size || '',
        orientation: item.image?.orientation || 'horizontal',
        type: item.image?.type || 'photo',
        author: item.author?.name || 'Freepik',
        authorAvatar: item.author?.avatar || '',
        freepikUrl: item.url || '',
        downloads: item.stats?.downloads || 0,
        likes: item.stats?.likes || 0,
      })).filter((img: any) => img.url); // Filter out items without valid URLs

      return { 
        images, 
        total: result.meta?.total || images.length,
        page: result.meta?.current_page || page,
        lastPage: result.meta?.last_page || 1,
      };
    }

    case 'videos': {
      // Search for videos
      const { query, page = 1, limit = 20, filters } = data;
      if (!query) throw new Error('query required');

      const params = new URLSearchParams({
        term: query as string,
        page: String(page),
        limit: String(Math.min(limit as number, 50)),
      });

      // Add optional filters
      if (filters) {
        const f = filters as Record<string, string>;
        if (f.duration) params.append('filters[duration]', f.duration);
        if (f.orientation) params.append('filters[orientation]', f.orientation);
      }

      const response = await fetch(`https://api.freepik.com/v1/videos?${params}`, { headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Freepik] Videos search error:`, errorText);
        throw new Error(`Freepik API error: ${response.status}`);
      }

      const result = await response.json();
      
      // Transform to simpler format for AI
      const videos = (result.data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        thumbnail: item.thumbnails?.[0]?.url,
        preview_url: item.video?.preview_url,
        duration: item.video?.duration,
        author: item.author?.name,
        premium: item.is_premium,
      }));

      return { 
        videos, 
        total: result.meta?.pagination?.total || videos.length,
        page: result.meta?.pagination?.current_page || page,
      };
    }

    case 'download': {
      // Get download URL for a resource
      const { resourceId, type = 'image' } = data;
      if (!resourceId) throw new Error('resourceId required');

      const endpoint = type === 'video' 
        ? `https://api.freepik.com/v1/videos/${resourceId}/download`
        : `https://api.freepik.com/v1/resources/${resourceId}/download`;

      const response = await fetch(endpoint, { headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Freepik] Download error:`, errorText);
        throw new Error(`Freepik API error: ${response.status}`);
      }

      const result = await response.json();
      return { 
        url: result.data?.url || result.url,
        filename: result.data?.filename,
      };
    }

    default:
      throw new Error(`Unknown freepik action: ${action}`);
  }
}

// Handle role operations
async function handleRoles(action: string, projectId: string, ownerId: string, data: Record<string, unknown>) {
  console.log(`[project-backend-api] Roles: ${action}`, data);

  switch (action) {
    case 'assign': {
      const { siteUserId, role, permissions } = data;
      if (!siteUserId) throw new Error('siteUserId required');

      const updates: Record<string, unknown> = {};
      if (role) updates.role = role;
      if (permissions) updates.permissions = permissions;

      const { data: user, error } = await supabase
        .from('project_site_users')
        .update(updates)
        .eq('id', siteUserId)
        .eq('project_id', projectId)
        .select('id, email, display_name, role, permissions')
        .single();

      if (error) throw new Error('Failed to assign role');
      return { user };
    }

    case 'check': {
      const { siteUserId, permission } = data;
      if (!siteUserId) throw new Error('siteUserId required');

      const { data: user, error } = await supabase
        .from('project_site_users')
        .select('role, permissions')
        .eq('id', siteUserId)
        .eq('project_id', projectId)
        .single();

      if (error || !user) throw new Error('User not found');

      // Check permission
      const hasPermission = permission
        ? (user.permissions as string[] || []).includes(permission as string) || user.role === 'owner' || user.role === 'admin'
        : true;

      return { role: user.role, permissions: user.permissions, hasPermission };
    }

    case 'list': {
      const { role } = data;

      let query = supabase
        .from('project_site_users')
        .select('id, email, display_name, role, permissions, created_at, last_login')
        .eq('project_id', projectId)
        .eq('status', 'active');

      if (role) {
        query = query.eq('role', role);
      }

      const { data: users, error } = await query;

      if (error) throw new Error('Failed to list users');
      return { users };
    }

    default:
      throw new Error(`Unknown roles action: ${action}`);
  }
}

// Handle notifications
async function handleNotifications(action: string, projectId: string, ownerId: string, data: Record<string, unknown>) {
  console.log(`[project-backend-api] Notifications: ${action}`, data);

  switch (action) {
    case 'list': {
      const { unreadOnly, limit = 50 } = data;

      let query = supabase
        .from('project_notifications')
        .select('*')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(limit as number);

      if (unreadOnly) {
        query = query.eq('read', false);
      }

      if (projectId && projectId !== 'all') {
        query = query.eq('project_id', projectId);
      }

      const { data: notifications, error } = await query;

      if (error) throw new Error('Failed to fetch notifications');
      return { notifications };
    }

    case 'markRead': {
      const { notificationId, all } = data;

      if (all) {
        await supabase
          .from('project_notifications')
          .update({ read: true })
          .eq('user_id', ownerId)
          .eq('read', false);
      } else if (notificationId) {
        await supabase
          .from('project_notifications')
          .update({ read: true })
          .eq('id', notificationId)
          .eq('user_id', ownerId);
      }

      return { success: true };
    }

    default:
      throw new Error(`Unknown notifications action: ${action}`);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const origin = req.headers.get('origin');
    const method = req.method;

    console.log(`[project-backend-api] ${method} ${url.pathname}`);

    // Parse request
    let body: RequestBody | null = null;
    let projectId: string | null = null;
    let action: string | null = null;
    let collection: string | null = null;
    let itemId: string | null = null;

    if (method === 'GET') {
      projectId = url.searchParams.get('projectId');
      action = url.searchParams.get('action');
      collection = url.searchParams.get('collection');
      itemId = url.searchParams.get('id');
    } else {
      const contentType = req.headers.get('content-type') || '';
      
      if (contentType.includes('multipart/form-data')) {
        // Handle file upload
        const formData = await req.formData();
        projectId = formData.get('projectId') as string;
        action = 'upload';
        
        // File upload logic
        const file = formData.get('file') as File;
        if (!file) {
          return new Response(
            JSON.stringify({ error: 'No file provided' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate request
        const validation = await validateRequest(projectId, origin);
        if (!validation.valid) {
          return new Response(
            JSON.stringify({ error: validation.error }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Upload file to storage
        const fileName = `${validation.ownerId}/${projectId}/${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('project-uploads')
          .upload(fileName, file);

        if (uploadError) {
          console.error(`[project-backend-api] Upload error:`, uploadError);
          return new Response(
            JSON.stringify({ error: 'Failed to upload file' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('project-uploads')
          .getPublicUrl(fileName);

        // Save upload record
        await supabase
          .from('project_uploads')
          .insert({
            project_id: projectId,
            user_id: validation.ownerId,
            filename: file.name,
            storage_path: fileName,
            file_type: file.type,
            size_bytes: file.size,
          });

        return new Response(
          JSON.stringify({ 
            success: true, 
            url: urlData.publicUrl,
            path: fileName,
            filename: file.name,
            size: file.size,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // JSON body
        body = (await req.json()) as RequestBody;
        projectId = body.projectId || null;
        action = body.action || null;
        collection = body.collection || null;
        itemId = body.id || null;
      }
    }

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'projectId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate project backend
    const validation = await validateRequest(projectId, origin);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ownerId = validation.ownerId!;

    // Route to handler
    let result: unknown;

    // Parse action - format: "action" or "collection/name" or "auth/action" or "cart/action" etc.
    if (action?.startsWith('collection/')) {
      const collectionName = action.replace('collection/', '');
      result = await handleCollection(method, projectId, ownerId, collectionName, body?.data, itemId || body?.id);
    } else if (action?.startsWith('auth/')) {
      const authAction = action.replace('auth/', '');
      result = await handleSiteAuth(authAction, projectId, ownerId, (body?.data || {}) as Record<string, unknown>);
    } else if (action?.startsWith('cart/')) {
      const cartAction = action.replace('cart/', '');
      result = await handleCart(cartAction, projectId, ownerId, (body?.data || {}) as Record<string, unknown>);
    } else if (action?.startsWith('order/')) {
      const orderAction = action.replace('order/', '');
      result = await handleOrder(orderAction, projectId, ownerId, (body?.data || {}) as Record<string, unknown>);
    } else if (action?.startsWith('inventory/')) {
      const inventoryAction = action.replace('inventory/', '');
      result = await handleInventory(inventoryAction, projectId, ownerId, (body?.data || {}) as Record<string, unknown>);
    } else if (action?.startsWith('booking/')) {
      const bookingAction = action.replace('booking/', '');
      result = await handleBooking(bookingAction, projectId, ownerId, (body?.data || {}) as Record<string, unknown>);
    } else if (action?.startsWith('chat/')) {
      const chatAction = action.replace('chat/', '');
      result = await handleChat(chatAction, projectId, ownerId, (body?.data || {}) as Record<string, unknown>);
    } else if (action?.startsWith('comments/')) {
      const commentsAction = action.replace('comments/', '');
      result = await handleComments(commentsAction, projectId, ownerId, (body?.data || {}) as Record<string, unknown>);
    } else if (action?.startsWith('roles/')) {
      const rolesAction = action.replace('roles/', '');
      result = await handleRoles(rolesAction, projectId, ownerId, (body?.data || {}) as Record<string, unknown>);
    } else if (action?.startsWith('notifications/')) {
      const notificationsAction = action.replace('notifications/', '');
      result = await handleNotifications(notificationsAction, projectId, ownerId, (body?.data || {}) as Record<string, unknown>);
    } else if (action?.startsWith('freepik/')) {
      const freepikAction = action.replace('freepik/', '');
      result = await handleFreepik(freepikAction, projectId, ownerId, (body?.data || {}) as Record<string, unknown>);
    } else if (action === 'submit' || action === 'subscribe') {
      const formName = body?.formName || (action === 'subscribe' ? 'newsletter' : 'contact');
      result = await handleFormSubmit(projectId, ownerId, formName, (body?.data || {}) as Record<string, unknown>, origin);
    } else if (collection) {
      // Legacy format: ?collection=products
      result = await handleCollection(method, projectId, ownerId, collection, body?.data, itemId || body?.id);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[project-backend-api] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
