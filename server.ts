import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db/index.ts';
import {
  users,
  ingredients,
  menuCategories,
  menuItems,
  customers,
  orders,
  stockLogs,
  wastageRecords,
  shiftRegisters,
  shiftConfigs,
  detailedShifts,
  suppliers,
  stockShipments,
  operationalExpenses,
  auditLogs,
  itemFeedbacks,
  promotionalOffers,
  businessSettingsTable,
  backupSnapshots,
} from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  // API HEALTH CHECK
  app.get('/api/health', async (_req, res) => {
    try {
      await db.select().from(businessSettingsTable).limit(1);
      res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ status: 'error', database: 'disconnected', error: err?.message || 'DB error' });
    }
  });

  // GET FULL DATA FROM DATABASE
  app.get('/api/db/sync', async (_req, res) => {
    try {
      const [
        allUsers,
        allIngredients,
        allCategories,
        allMenuItems,
        allCustomers,
        allOrders,
        allStockLogs,
        allWastage,
        allShifts,
        allShiftConfigs,
        allDetailedShifts,
        allSuppliers,
        allShipments,
        allExpenses,
        allAuditLogs,
        allFeedbacks,
        allOffers,
        settingsRow,
      ] = await Promise.all([
        db.select().from(users),
        db.select().from(ingredients),
        db.select().from(menuCategories),
        db.select().from(menuItems),
        db.select().from(customers),
        db.select().from(orders),
        db.select().from(stockLogs),
        db.select().from(wastageRecords),
        db.select().from(shiftRegisters),
        db.select().from(shiftConfigs),
        db.select().from(detailedShifts),
        db.select().from(suppliers),
        db.select().from(stockShipments),
        db.select().from(operationalExpenses),
        db.select().from(auditLogs),
        db.select().from(itemFeedbacks),
        db.select().from(promotionalOffers),
        db.select().from(businessSettingsTable).where(eq(businessSettingsTable.id, 'default_settings')),
      ]);

      res.json({
        success: true,
        data: {
          staff: allUsers,
          ingredients: allIngredients,
          menuCategories: allCategories,
          menuItems: allMenuItems,
          customers: allCustomers,
          orders: allOrders,
          stockLogs: allStockLogs,
          wastageRecords: allWastage,
          shiftRegisters: allShifts,
          shiftConfigs: allShiftConfigs,
          detailedShifts: allDetailedShifts,
          suppliers: allSuppliers,
          stockShipments: allShipments,
          expenses: allExpenses,
          auditLogs: allAuditLogs,
          itemFeedbacks: allFeedbacks,
          promotionalOffers: allOffers,
          businessSettings: settingsRow?.[0]?.data || null,
        },
      });
    } catch (error: any) {
      console.error('Error fetching database state:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST FULL OR PARTIAL SYNC TO DATABASE
  app.post('/api/db/sync', async (req, res) => {
    try {
      const {
        staff,
        ingredients: ingList,
        menuCategories: catList,
        menuItems: itemList,
        customers: custList,
        orders: ordList,
        stockLogs: logList,
        wastageRecords: wasteList,
        shiftRegisters: shiftList,
        shiftConfigs: cfgList,
        detailedShifts: dShiftList,
        suppliers: suppList,
        stockShipments: shipList,
        expenses: expList,
        auditLogs: auditList,
        itemFeedbacks: feedList,
        promotionalOffers: offerList,
        businessSettings: settingsData,
      } = req.body;

      // Sync Ingredients
      if (Array.isArray(ingList) && ingList.length > 0) {
        for (const item of ingList) {
          await db.insert(ingredients).values({
            id: item.id,
            name: item.name,
            category: item.category,
            currentStock: item.currentStock,
            minThreshold: item.minThreshold,
            unit: item.unit,
            costPerUnit: item.costPerUnit,
            supplier: item.supplier,
            lastRestocked: item.lastRestocked || new Date().toISOString(),
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
          }).onConflictDoUpdate({
            target: ingredients.id,
            set: {
              currentStock: item.currentStock,
              minThreshold: item.minThreshold,
              costPerUnit: item.costPerUnit,
              supplier: item.supplier,
              lastRestocked: item.lastRestocked || new Date().toISOString(),
            },
          });
        }
      }

      // Sync Menu Items
      if (Array.isArray(itemList) && itemList.length > 0) {
        for (const item of itemList) {
          await db.insert(menuItems).values({
            id: item.id,
            name: item.name,
            category: item.category,
            price: item.price,
            costToProduce: item.costToProduce || 0,
            rewardPointsPrice: item.rewardPointsPrice || 0,
            image: item.image || '',
            description: item.description || '',
            isAvailable: item.isAvailable ?? true,
            recipe: item.recipe || [],
            barcode: item.barcode,
            sizes: item.sizes || [],
            customizations: item.customizations || [],
          }).onConflictDoUpdate({
            target: menuItems.id,
            set: {
              price: item.price,
              costToProduce: item.costToProduce || 0,
              isAvailable: item.isAvailable ?? true,
              recipe: item.recipe || [],
              sizes: item.sizes || [],
              customizations: item.customizations || [],
            },
          });
        }
      }

      // Sync Orders
      if (Array.isArray(ordList) && ordList.length > 0) {
        for (const item of ordList) {
          await db.insert(orders).values({
            id: item.id,
            receiptNumber: item.receiptNumber,
            createdAt: item.createdAt,
            items: item.items || [],
            subtotal: item.subtotal,
            discount: item.discount,
            autoTierDiscount: item.autoTierDiscount,
            appliedTierName: item.appliedTierName,
            pointsDiscount: item.pointsDiscount,
            tax: item.tax,
            tip: item.tip,
            total: item.total,
            paymentMethod: item.paymentMethod,
            cashTendered: item.cashTendered,
            changeDue: item.changeDue,
            customerId: item.customerId,
            customerName: item.customerName,
            pointsEarned: item.pointsEarned || 0,
            pointsRedeemed: item.pointsRedeemed || 0,
            staffId: item.staffId,
            staffName: item.staffName,
            status: item.status || 'completed',
            isOfflineCreated: item.isOfflineCreated || false,
            syncedAt: new Date().toISOString(),
            orderType: item.orderType || 'dine-in',
            tableNumber: item.tableNumber,
            tableLocation: item.tableLocation,
            deliveryAddress: item.deliveryAddress,
            deliveryNotes: item.deliveryNotes,
            estimatedPrepMinutes: item.estimatedPrepMinutes,
          }).onConflictDoUpdate({
            target: orders.id,
            set: {
              status: item.status || 'completed',
              items: item.items || [],
              subtotal: item.subtotal,
              discount: item.discount,
              tax: item.tax,
              tip: item.tip,
              total: item.total,
              orderType: item.orderType || 'dine-in',
              tableNumber: item.tableNumber,
              tableLocation: item.tableLocation,
              deliveryAddress: item.deliveryAddress,
              deliveryNotes: item.deliveryNotes,
              estimatedPrepMinutes: item.estimatedPrepMinutes,
              syncedAt: new Date().toISOString(),
            },
          });
        }
      }

      // Sync Customers
      if (Array.isArray(req.body.customers) && req.body.customers.length > 0) {
        for (const item of req.body.customers) {
          await db.insert(customers).values({
            id: item.id,
            code: item.code,
            name: item.name,
            phone: item.phone,
            email: item.email,
            pointsBalance: item.pointsBalance || 0,
            totalSpent: item.totalSpent || 0,
            ordersCount: item.ordersCount || 0,
            tier: item.tier || 'Bronze',
            joinedDate: item.joinedDate || new Date().toISOString(),
            lastVisit: item.lastVisit || new Date().toISOString(),
            notes: item.notes,
            kind: item.kind,
            classification: item.classification,
            dob: item.dob,
            address: item.address,
            promoCode: item.promoCode,
            discountPercent: item.discountPercent,
          }).onConflictDoUpdate({
            target: customers.id,
            set: {
              pointsBalance: item.pointsBalance || 0,
              totalSpent: item.totalSpent || 0,
              ordersCount: item.ordersCount || 0,
              tier: item.tier || 'Bronze',
              lastVisit: item.lastVisit || new Date().toISOString(),
            },
          });
        }
      }

      // Sync Settings
      if (settingsData) {
        await db.insert(businessSettingsTable).values({
          id: 'default_settings',
          data: settingsData,
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: businessSettingsTable.id,
          set: {
            data: settingsData,
            updatedAt: new Date(),
          },
        });
      }

      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error: any) {
      console.error('Error saving sync data to database:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // CREATE AUTO OR MANUAL BACKUP SNAPSHOT
  app.post('/api/db/backup', async (req, res) => {
    try {
      const { description = 'Automated SQL Backup Snapshot', triggerType = 'auto', fullData } = req.body;
      const backupId = `backup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const timestamp = new Date().toISOString();

      let snapshotData = fullData;

      if (!snapshotData) {
        // Fetch full state if not provided in body
        const [
          allUsers, allIng, allCats, allItems, allCust, allOrd, allLogs, allWaste, allShifts, allSettings
        ] = await Promise.all([
          db.select().from(users),
          db.select().from(ingredients),
          db.select().from(menuCategories),
          db.select().from(menuItems),
          db.select().from(customers),
          db.select().from(orders),
          db.select().from(stockLogs),
          db.select().from(wastageRecords),
          db.select().from(shiftRegisters),
          db.select().from(businessSettingsTable).where(eq(businessSettingsTable.id, 'default_settings')),
        ]);

        snapshotData = {
          staff: allUsers,
          ingredients: allIng,
          menuCategories: allCats,
          menuItems: allItems,
          customers: allCust,
          orders: allOrd,
          stockLogs: allLogs,
          wastageRecords: allWaste,
          shiftRegisters: allShifts,
          businessSettings: allSettings?.[0]?.data || null,
        };
      }

      await db.insert(backupSnapshots).values({
        id: backupId,
        timestamp,
        triggerType,
        description,
        fullData: snapshotData,
        status: 'active',
      });

      res.json({
        success: true,
        backup: {
          id: backupId,
          timestamp,
          triggerType,
          description,
        },
      });
    } catch (error: any) {
      console.error('Error creating database backup:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET LIST OF ALL BACKUPS
  app.get('/api/db/backups', async (_req, res) => {
    try {
      const list = await db
        .select({
          id: backupSnapshots.id,
          timestamp: backupSnapshots.timestamp,
          triggerType: backupSnapshots.triggerType,
          description: backupSnapshots.description,
          status: backupSnapshots.status,
        })
        .from(backupSnapshots)
        .orderBy(desc(backupSnapshots.timestamp))
        .limit(30);

      res.json({ success: true, backups: list });
    } catch (error: any) {
      console.error('Error fetching backups list:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // RESTORE FROM SPECIFIC BACKUP ID
  app.post('/api/db/restore', async (req, res) => {
    try {
      const { backupId } = req.body;
      if (!backupId) {
        return res.status(400).json({ success: false, error: 'backupId is required' });
      }

      const rows = await db.select().from(backupSnapshots).where(eq(backupSnapshots.id, backupId));
      if (!rows.length) {
        return res.status(404).json({ success: false, error: 'Backup snapshot not found' });
      }

      const snapshot = rows[0].fullData as any;
      res.json({ success: true, restoredData: snapshot });
    } catch (error: any) {
      console.error('Error restoring backup snapshot:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // AUTOMATED PERIODIC BACKUP SCHEDULER (Runs every 2 hours in background)
  setInterval(async () => {
    try {
      console.log('Running automated scheduled database backup snapshot...');
      const [allIng, allItems, allOrd, allCust] = await Promise.all([
        db.select().from(ingredients),
        db.select().from(menuItems),
        db.select().from(orders),
        db.select().from(customers),
      ]);

      const backupId = `auto_backup_${Date.now()}`;
      await db.insert(backupSnapshots).values({
        id: backupId,
        timestamp: new Date().toISOString(),
        triggerType: 'auto',
        description: `Automated 2-Hour Auto Backup (${allOrd.length} Orders, ${allItems.length} Menu Items)`,
        fullData: { ingredients: allIng, menuItems: allItems, orders: allOrd, customers: allCust },
        status: 'active',
      });
      console.log(`Auto backup snapshot created successfully: ${backupId}`);
    } catch (err) {
      console.error('Automated backup interval error:', err);
    }
  }, 2 * 60 * 60 * 1000);

  // VITE DEVELOPMENT VS PRODUCTION MIDDLEWARE
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BaristaPro Express + SQL Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
