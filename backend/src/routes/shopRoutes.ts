import { Router } from 'express';
import { requireAuth, requireVerifiedEmail, requireConfirmedLinking } from '../middleware/requireAuth.js';
import { supabase, SupabaseConfigurationError } from '../lib/supabase.js';

const router = Router();

/**
 * GET /api/shops/memberships
 * Returns all shop memberships for the verified user.
 * Strictly requires confirmed account linking to prevent unauthorized legacy shop access.
 */
router.get('/memberships', requireAuth, requireConfirmedLinking, async (_req, res) => {
  try {
    const user = res.locals.user;

    const { data, error } = await supabase
      .from('shop_members')
      .select('shop_id, role, created_at')
      .eq('user_id', user.internalUserId);

    if (error) {
      console.error('Membership query failed:', error.code, error.message);
      res.status(500).json({
        success: false,
        message: 'Unable to retrieve shop memberships',
      });
      return;
    }

    res.status(200).json({
      success: true,
      memberships: data ?? [],
    });
  } catch (err) {
    if (err instanceof SupabaseConfigurationError) {
      res.status(500).json({
        success: false,
        message: 'A server configuration error occurred',
      });
      return;
    }
    console.error('Unexpected error in memberships route');
    res.status(500).json({
      success: false,
      message: 'Unexpected server error',
    });
  }
});

/**
 * GET /api/shops/:shopId
 * Retrieves shop details. Strictly enforces that caller is an authorized member.
 */
router.get('/:shopId', requireAuth, requireConfirmedLinking, async (req, res) => {
  try {
    const user = res.locals.user;
    const { shopId } = req.params;

    if (!shopId) {
      res.status(400).json({ success: false, message: 'Shop ID is required' });
      return;
    }

    // Verify caller membership before exposing shop data
    const { data: member, error: memberErr } = await supabase
      .from('shop_members')
      .select('role')
      .eq('shop_id', shopId)
      .eq('user_id', user.internalUserId)
      .maybeSingle();

    if (memberErr || !member) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to view this shop',
      });
      return;
    }

    const { data: shop, error: shopErr } = await supabase
      .from('shops')
      .select('id, name, phone, created_at')
      .eq('id', shopId)
      .maybeSingle();

    if (shopErr || !shop) {
      res.status(404).json({ success: false, message: 'Shop not found' });
      return;
    }

    res.status(200).json({
      success: true,
      shop: {
        ...shop,
        callerRole: member.role,
      },
    });
  } catch (err) {
    if (err instanceof SupabaseConfigurationError) {
      res.status(500).json({
        success: false,
        message: 'A server configuration error occurred',
      });
      return;
    }
    console.error('Unexpected error in shop detail route');
    res.status(500).json({ success: false, message: 'Unexpected server error' });
  }
});

/**
 * PATCH /api/shops/:shopId
 * Updates shop details (name, phone). Requires verified email and confirmed linking.
 * Strictly verifies caller is an owner of the shop.
 */
router.patch('/:shopId', requireAuth, requireVerifiedEmail, requireConfirmedLinking, async (req, res) => {
  try {
    const user = res.locals.user;
    const { shopId } = req.params;
    const { shopName, phone } = req.body ?? {};

    if (!shopId) {
      res.status(400).json({ success: false, message: 'Shop ID is required' });
      return;
    }

    // Verify caller is an authorized owner of this shop
    const { data: member, error: memberErr } = await supabase
      .from('shop_members')
      .select('role')
      .eq('shop_id', shopId)
      .eq('user_id', user.internalUserId)
      .maybeSingle();

    if (memberErr || !member || member.role !== 'owner') {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to update this shop',
      });
      return;
    }

    const updates: { name?: string; phone?: string | null } = {};

    if (shopName !== undefined) {
      if (typeof shopName !== 'string' || !shopName.trim() || shopName.trim().length > 150) {
        res.status(400).json({
          success: false,
          message: 'Shop name is required and must be at most 150 characters',
        });
        return;
      }
      updates.name = shopName.trim();
    }

    if (phone !== undefined) {
      if (phone !== null && typeof phone !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Invalid phone number',
        });
        return;
      }
      if (typeof phone === 'string' && phone.length > 30) {
        res.status(400).json({
          success: false,
          message: 'Phone number is too long',
        });
        return;
      }
      updates.phone = typeof phone === 'string' ? phone.trim() || null : null;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        message: 'No valid shop fields provided for update',
      });
      return;
    }

    // Try RPC update_shop_for_user first if available, else direct table update
    let updatedShop: { id: string; name: string; phone: string | null; created_at?: string } | null = null;

    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('update_shop_for_user', {
        p_user_id: user.internalUserId,
        p_shop_id: shopId,
        p_shop_name: updates.name ?? null,
        p_phone: updates.phone ?? null,
      });

      if (!rpcErr && rpcData) {
        updatedShop = (rpcData as any).shop ?? rpcData;
      }
    } catch {
      // Fallback to direct update
    }

    if (!updatedShop) {
      const { data: directData, error: updateErr } = await supabase
        .from('shops')
        .update(updates)
        .eq('id', shopId)
        .select('id, name, phone, created_at')
        .maybeSingle();

      if (updateErr) {
        console.error('Shop update failed:', updateErr.code, updateErr.message);
        res.status(500).json({
          success: false,
          message: 'Unable to update shop details',
        });
        return;
      }
      updatedShop = directData;
    }

    res.status(200).json({
      success: true,
      shop: updatedShop,
    });
  } catch (err) {
    if (err instanceof SupabaseConfigurationError) {
      res.status(500).json({
        success: false,
        message: 'A server configuration error occurred',
      });
      return;
    }
    console.error('Unexpected error in shop update route');
    res.status(500).json({ success: false, message: 'Unexpected server error' });
  }
});

/**
 * POST /api/shops/register
 * Registers a new shop. Requires verified email and confirmed linking.
 * Atomically inserts shop and membership using internalUserId.
 */
router.post('/register', requireAuth, requireVerifiedEmail, requireConfirmedLinking, async (req, res) => {
  try {
    const { shopName, phone } = req.body ?? {};

    if (
      typeof shopName !== 'string' ||
      !shopName.trim() ||
      shopName.trim().length > 150
    ) {
      res.status(400).json({
        success: false,
        message: 'Shop name is required and must be at most 150 characters',
      });
      return;
    }

    if (phone !== undefined && phone !== null && typeof phone !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Invalid phone number',
      });
      return;
    }

    if (typeof phone === 'string' && phone.length > 30) {
      res.status(400).json({
        success: false,
        message: 'Phone number is too long',
      });
      return;
    }

    const user = res.locals.user;
    const trimmedShopName = shopName.trim();
    const formattedPhone = typeof phone === 'string' ? phone.trim() || null : null;

    // 1. Check if user already has an existing shop membership
    const { data: existingMembers, error: checkErr } = await supabase
      .from('shop_members')
      .select('shop_id')
      .eq('user_id', user.internalUserId)
      .limit(1);

    if (checkErr) {
      console.error('Membership check failed:', checkErr.code, checkErr.message);
      res.status(500).json({
        success: false,
        message: 'Unable to verify existing shop membership',
      });
      return;
    }

    if (existingMembers && existingMembers.length > 0) {
      res.status(409).json({
        success: false,
        message: 'You already have a shop membership',
      });
      return;
    }

    // 2. Invoke the atomic stored procedure register_shop_for_user
    let rpcData: Record<string, unknown> | null = null;
    let rpcError: { code?: string; message: string } | null = null;

    const resForUser = await supabase.rpc('register_shop_for_user', {
      p_user_id: user.internalUserId,
      p_shop_name: trimmedShopName,
      p_phone: formattedPhone,
    });

    rpcData = resForUser.data as Record<string, unknown> | null;
    rpcError = resForUser.error;

    if (rpcError) {
      console.error('Shop registration RPC failed:', rpcError.code, rpcError.message);

      if (rpcError.message.includes('already has a shop membership')) {
        res.status(409).json({
          success: false,
          message: 'You already have a shop membership',
        });
        return;
      }

      if (
        rpcError.message.includes('Shop name is required') ||
        rpcError.message.includes('Shop name is too long')
      ) {
        res.status(400).json({
          success: false,
          message: 'Shop name is invalid',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Unable to register shop. Please ensure database migration has been applied.',
      });
      return;
    }

    if (!rpcData) {
      console.error('Shop registration RPC returned no data');
      res.status(500).json({
        success: false,
        message: 'Unable to register shop',
      });
      return;
    }

    res.status(201).json({
      ...rpcData,
      success: true,
    });
  } catch (err) {
    if (err instanceof SupabaseConfigurationError) {
      res.status(500).json({
        success: false,
        message: 'A server configuration error occurred',
      });
      return;
    }
    console.error('Shop registration unexpected error');
    res.status(500).json({
      success: false,
      message: 'Unexpected server error',
    });
  }
});

export default router;
