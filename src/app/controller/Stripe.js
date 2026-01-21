const mongoose = require("mongoose");
const responseg = require("./../responses");
// import Stripe from "stripe";
const Product = mongoose.model("Product");
const Stripe = require("stripe");
const productRequest = require("../model/product-request");
// const { response } = require("express");
const User = mongoose.model("User");

const stripe = new Stripe(process.env.NEXT_PrUBLIC_STRIPE_API_SECRET_KEY);
const mailNotification = require("../services/mailNotification");
// const stripe = new Stripe(process.env.NODE_ENV === 'development' ? process.env.NEXT_TEST_PUBLIC_STRIPE_API_SECRET_KEY : process.env.NEXT_PrUBLIC_STRIPE_API_SECRET_KEY);
const { notify } = require("../services/notification");
const { decryptObject } = require("../../middlewares/codeDecript");

module.exports = {
  poststripe: async (req, res) => {
    try {
      const priceFormatStripe = Math.round(req.body.price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: priceFormatStripe,
        currency: req.body.currency,
        automatic_payment_methods: {
          enabled: true,
        },
        // payment_method_types: ["card"],
      });
      // // console.log(paymentIntent);
      res.status(200).send({
        clientSecret: paymentIntent.client_secret,
        price: req.body.price,
        error: null,
      });
    } catch (err) {
      // // console.log(err);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // createPayment: async (req, res) => {
  //   try {
  //     const { amount, currency, customer, metadata } = req.body;

  //     // Create or retrieve customer
  //     let stripeCustomer;
  //     if (customer.email) {
  //       const existingCustomers = await stripe.customers.list({
  //         email: customer.email,
  //         limit: 1,
  //       });

  //       if (existingCustomers.data.length > 0) {
  //         stripeCustomer = existingCustomers.data[0];
  //       } else {
  //         stripeCustomer = await stripe.customers.create({
  //           email: customer.email,
  //           name: customer.name,
  //           address: customer.address,
  //         });
  //       }
  //     }

  //     // Create ephemeral key for customer
  //     const ephemeralKey = await stripe.ephemeralKeys.create(
  //       { customer: stripeCustomer.id },
  //       { apiVersion: "2020-08-27" }
  //     );

  //     // Create payment intent
  //     const paymentIntent = await stripe.paymentIntents.create({
  //       amount: amount,
  //       currency: currency || "usd",
  //       customer: stripeCustomer.id,
  //       automatic_payment_methods: {
  //         enabled: true,
  //       },
  //       metadata: metadata || {},
  //     });

  //     res.json({
  //       clientSecret: paymentIntent.client_secret,
  //       ephemeralKey: ephemeralKey.secret,
  //       customer: stripeCustomer.id,
  //       publishableKey: process.env.STRIPE_API_PUBLIC_KEY,
  //     });
  //   } catch (error) {
  //     // // console.error("Error creating payment intent:", error);
  //     res.status(400).json({ error: error.message });
  //   }
  // },

  createPayment: async (req, res) => {
    try {
      const { customer, cart, successUrl, cancelUrl } = req.body;

      if (!cart || !Array.isArray(cart) || cart.length === 0) {
        return res.status(400).json({ error: "Cart is empty or invalid." });
      }

      let stripeCustomer;
      if (customer?.email) {
        const existing = await stripe.customers.list({
          email: customer.email,
          limit: 1,
        });
        if (existing.data.length > 0) {
          stripeCustomer = existing.data[0];
        } else {
          stripeCustomer = await stripe.customers.create({
            email: customer.email,
            name: customer.name,
            address: customer.address,
          });
        }
      } else {
        return res.status(400).json({ error: "Customer email is required." });
      }

      const line_items = cart.map((item) => {
        const unitAmount = Math.round(Number(item.offer || item.price) * 100);

        return {
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            product_data: {
              name: item.productname,
              tax_code: item.tax_code || "txcd_99999999",
            },
          },
          quantity: item.qty || 1,
          tax_behavior: "exclusive",
        };
      });

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: stripeCustomer.id,
        line_items,
        automatic_tax: { enabled: true },
        success_url: successUrl || "https://yourdomain.com/success",
        cancel_url: cancelUrl || "https://yourdomain.com/cancel",
      });

      return res.status(200).json({ checkoutUrl: session.url });
    } catch (err) {
      // // console.error("Stripe Checkout error:", err);
      return res.status(500).json({ error: err.message });
    }
  },

  createCheckout: async (req, res) => {
    try {
      const {
        metadata,
        customer_data,
        line_items,
        customer_email,
        customer_update,
        shipping_options,
        shipping_address_collection,
        automatic_tax,
        billing_address_collection,
        success_url,
        cancel_url,
      } = req.body;

      if (metadata?.isLocalDelivery === "true" && !customer_data?.address) {
        return res.status(400).json({
          error: "Delivery address is required for local delivery orders",
          code: "MISSING_DELIVERY_ADDRESS",
        });
      }

      const deliveryTip = metadata?.deliveryTip
        ? parseFloat(metadata.deliveryTip)
        : 0;
      const serviceFee = metadata?.serviceFee
        ? parseFloat(metadata.serviceFee)
        : 0;

      const hasDiscount = metadata?.hasDiscount === "true";
      const discountAmount = hasDiscount
        ? parseFloat(metadata.discountAmount || 0)
        : 0;
      const discountCode = metadata?.discountCode || "";

      // // console.log("Received metadata:", metadata);
      // // console.log("Received line_items count:", line_items?.length || 0);
      // // console.log("Discount info:", {
      //       //         hasDiscount,
      //       //         discountAmount,
      //       //         discountCode,
      //       //       });

      const processedLineItems = [
        ...line_items.map((item) => ({
          ...item,
          price_data: {
            ...item.price_data,
            tax_behavior: "exclusive",
            product_data: {
              ...item.price_data.product_data,
              tax_code:
                item.price_data?.product_data?.tax_code || "txcd_10000000",
            },
          },
        })),
        ...(deliveryTip > 0
          ? [
            {
              price_data: {
                currency: "usd",
                unit_amount: Math.round(deliveryTip * 100),
                product_data: {
                  name: "Delivery Tip",
                  tax_code: "txcd_90020001",
                },
                tax_behavior: "exclusive",
              },
              quantity: 1,
            },
          ]
          : []),
        ...(serviceFee > 0
          ? [
            {
              price_data: {
                currency: "usd",
                unit_amount: Math.round(serviceFee * 100),
                product_data: {
                  name: "Service Fee",
                  tax_code: "txcd_10000000",
                },
                tax_behavior: "exclusive",
              },
              quantity: 1,
            },
          ]
          : []),
      ];
      const isPickupOrder =
        metadata?.isPickupOrder === "true" || metadata?.isCurbside === "true";

      const storeLocation = {
        line1: "11360 Bellaire Blvd Suite 700",
        city: "Houston",
        state: "TX",
        postal_code: "77072",
        country: "US",
      };

      let stripeCustomer = null;
      if (customer_data?.email || customer_email) {
        const email = customer_data?.email || customer_email;

        const existingCustomers = await stripe.customers.list({
          email: email,
          limit: 1,
        });

        if (existingCustomers.data.length > 0) {
          const addressToUse = isPickupOrder
            ? storeLocation
            : customer_data?.address;

          stripeCustomer = await stripe.customers.update(
            existingCustomers.data[0].id,
            {
              name: customer_data?.name,
              phone: customer_data?.phone,
              address: addressToUse,
              metadata: {
                userId: metadata?.userId || "",
                lastUpdated: new Date().toISOString(),
                isPickupOrder: isPickupOrder.toString(),
              },
            }
          );
          // // console.log(
          //           //             "Updated existing Stripe customer:",
          //           //             stripeCustomer.id,
          //           //             "isPickupOrder:",
          //           //             isPickupOrder
          //           //           );
        } else {
          const addressToUse = isPickupOrder
            ? storeLocation
            : customer_data?.address || {};

          stripeCustomer = await stripe.customers.create({
            email: email,
            name: customer_data?.name || "",
            phone: customer_data?.phone || "",
            address: addressToUse,
            metadata: {
              userId: metadata?.userId || "",
              createdAt: new Date().toISOString(),
              isPickupOrder: isPickupOrder.toString(),
            },
          });
          // // console.log(
          //           //             "Created new Stripe customer:",
          //           //             stripeCustomer.id,
          //           //             "isPickupOrder:",
          //           //             isPickupOrder
          //           //           );
        }
      }

      let couponId = null;
      if (hasDiscount && discountAmount > 0) {
        try {
          // // console.log(
          //           //             `Creating coupon for discount: $${discountAmount} (${discountCode})`
          //           //           );

          const uniqueCouponId = `discount_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 9)}`;

          const coupon = await stripe.coupons.create({
            amount_off: Math.round(discountAmount * 100),
            currency: "usd",
            name: discountCode || "Discount",
            id: uniqueCouponId,
            max_redemptions: 1,
            redeem_by: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
            metadata: {
              originalAmount: discountAmount.toString(),
              appliedAt: new Date().toISOString(),
              source: "grocery_app_coupon",
            },
          });

          couponId = coupon.id;
          // // console.log("Successfully created coupon:", {
          //           //             couponId: couponId,
          //           //             discountAmount: discountAmount,
          //           //             discountCode: discountCode,
          //           //             amountOffCents: Math.round(discountAmount * 100),
          //           //           });
        } catch (couponError) {
          // // console.error("Failed to create coupon:", couponError.message);
          // // console.error("Full coupon error:", couponError);
          // Continue without discount rather than failing the entire checkout
        }
      }

      const sessionConfig = {
        payment_method_types: ["card"],
        line_items: processedLineItems,
        mode: "payment",
        automatic_tax: { enabled: true },
        customer: stripeCustomer?.id,
        billing_address_collection: billing_address_collection || "auto",
        customer_update: customer_update || {
          shipping: "auto",
        },
        success_url:
          success_url ||
          "groceryapp://payment-success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: cancel_url || "groceryapp://payment-cancel",
        metadata: {
          ...metadata,
        },
        // Add discount if coupon was created
        ...(couponId && {
          discounts: [
            {
              coupon: couponId,
            },
          ],
        }),
        ...(isPickupOrder
          ? {}
          : {
            shipping_address_collection: shipping_address_collection || {
              allowed_countries: ["US"],
            },
            ...(shipping_options && {
              shipping_options: shipping_options.map((option) => ({
                ...option,
                shipping_rate_data: {
                  ...option.shipping_rate_data,
                  tax_behavior: "exclusive",
                  tax_code: "txcd_92010001",
                },
              })),
            }),
          }),
        tax_id_collection: {
          enabled: false,
        },
      };

      // // console.log(
      //       //         "Processed line items:",
      //       //         processedLineItems.map((item) => ({
      //       //           name: item.price_data?.product_data?.name,
      //       //           amount: item.price_data?.unit_amount,
      //       //           tax_behavior: item.price_data?.tax_behavior,
      //       //           tax_code: item.price_data?.product_data?.tax_code,
      //       //           type: "product",
      //       //         }))
      //       //       );

      if (couponId) {
        // // console.log("Applied discount to checkout session:", {
        //         //           couponId: couponId,
        //         //           discountAmount: discountAmount,
        //         //           discountCode: discountCode,
        //         //           sessionMetadata: {
        //         //             hasDiscount: metadata?.hasDiscount,
        //         //             discountAmount: metadata?.discountAmount,
        //         //             discountCode: metadata?.discountCode,
        //         //           },
        //         //         });
      } else if (hasDiscount) {
        // // console.log("Discount was requested but coupon creation failed:", {
        //         //           hasDiscount: hasDiscount,
        //         //           discountAmount: discountAmount,
        //         //           discountCode: discountCode,
        //         //         });
      }

      if (sessionConfig.shipping_options) {
        // // console.log(
        //         //           "Shipping options:",
        //         //           sessionConfig.shipping_options.map((option) => ({
        //         //             display_name: option.shipping_rate_data?.display_name,
        //         //             amount: option.shipping_rate_data?.fixed_amount?.amount,
        //         //             tax_behavior: option.shipping_rate_data?.tax_behavior,
        //         //             tax_code: option.shipping_rate_data?.tax_code,
        //         //           }))
        //         //         );
      }

      // // console.log("About to create Stripe session with config:", {
      //       //         hasDiscounts: !!couponId,
      //       //         discountConfig: couponId ? { couponId } : null,
      //       //         lineItemsCount: processedLineItems.length,
      //       //         customerEmail: customer_data?.email || customer_email,
      //       //         automaticTaxEnabled: sessionConfig.automatic_tax?.enabled,
      //       //       });

      const session = await stripe.checkout.sessions.create(sessionConfig);

      res.json({
        url: session.url,
        session_id: session.id,
        customer_id: stripeCustomer?.id,
      });
    } catch (error) {
      // // console.error("Stripe createCheckout error:", error);
      res.status(400).json({ error: error.message });
    }
  },

  retrieveCheckout: async (req, res) => {
    try {
      const { session_id } = req.body;

      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["total_details.breakdown", "line_items"],
      });

      const lineItems = session.line_items?.data || [];
      const tipLineItem = lineItems.find(
        (item) =>
          item.description === "Delivery Tip" ||
          item.price?.product?.name === "Delivery Tip"
      );

      const deliveryTip = tipLineItem ? tipLineItem.amount_total / 100 : 0;

      res.json({
        payment_intent: session.payment_intent,
        amount_total: session.amount_total,
        amount_subtotal: session.amount_subtotal,
        currency: session.currency,
        total_details: session.total_details,
        metadata: session.metadata,
        delivery_tip: {
          amount: deliveryTip,
          amount_cents: tipLineItem ? tipLineItem.amount_total : 0,
          included_in_subtotal: true,
          taxable: true,
          line_item_id: tipLineItem ? tipLineItem.id : null,
        },
        line_items_breakdown: lineItems.map((item) => ({
          name: item.description,
          amount: item.amount_total / 100,
          quantity: item.quantity,
          is_tip: item.description === "Delivery Tip",
        })),
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  NewRetrieveCheckout: async (req, res) => {
    try {
      const { session_id, orderID } = req.body;

      if (!session_id && !orderID) {
        return res.status(400).json({
          message: "session_id and orderID are required",
        });
      }

      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["total_details.breakdown", "line_items"],
      });

      const lineItems = session.line_items?.data || [];

      const tipLineItem = lineItems.find(
        (item) =>
          item.description === "Delivery Tip" ||
          item.price?.product?.name === "Delivery Tip"
      );

      const deliveryTip = tipLineItem ? tipLineItem.amount_total / 100 : 0;

      const order = await productRequest.findOne({ orderId: orderID });
      const userReq = await User.findById(order?.user);

      let user = decryptObject(userReq);
      // console.log(user)

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.paymentStatus === "Succeeded") {
        return res.status(200).json({
          message: "Payment Already Processed",
          success: true,
        });
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      order.paymentStatus = "Succeeded";
      order.currency = session.currency || "USD";

      order.discount = session.total_details?.amount_discount
        ? (session.total_details.amount_discount / 100).toFixed(2)
        : "0.00";

      order.totalTax = session.total_details?.amount_tax
        ? (session.total_details.amount_tax / 100).toFixed(2)
        : "0.00";

      order.subtotal = session.amount_subtotal
        ? (session.amount_subtotal / 100).toFixed(2)
        : "0.00";

      order.stripeSessionId = session_id;

      await Promise.all(
        order.productDetail.map(async (productItem) => {
          await Product.findByIdAndUpdate(
            productItem.product,
            {
              $inc: {
                sold_pieces: productItem.qty,
                Quantity: -productItem.qty, // Decrease available quantity
              },
            },
            { new: true }
          );
        })
      );

      await order.save();

      await mailNotification.order({
        email: user.email,
        orderId: order.orderId,
      });

      await notify(
        user._id,
        "Order Placed",
        `Your order with ID ${order.orderId} has been received.`,
        order.orderId
      );

      const newOrder = {
        payment_intent: session.payment_intent,
        amount_total: session.amount_total / 100,
        amount_subtotal: session.amount_subtotal / 100,
        currency: session.currency,
        total_details: session.total_details,
        metadata: session.metadata,

        delivery_tip: {
          amount: deliveryTip,
          amount_cents: tipLineItem ? tipLineItem.amount_total : 0,
          included_in_subtotal: true,
          taxable: true,
          line_item_id: tipLineItem ? tipLineItem.id : null,
        },

        line_items_breakdown: lineItems.map((item) => ({
          name: item.description,
          amount: item.amount_total / 100,
          quantity: item.quantity,
          is_tip: item.description === "Delivery Tip",
        })),
      };

      return responseg.ok(res, {
        message: "Payment Successful",
        orders: newOrder,
      });
    } catch (error) {
      // // console.error("Stripe Retrieve Error:", error);
      res.status(400).json({ error: error.message });
    }
  },

  testTaxCalculation: async (req, res) => {
    try {
      const testSession1 = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Test Item",
                tax_code: "txcd_10000000",
              },
              unit_amount: 1000,
              tax_behavior: "exclusive",
            },
            quantity: 1,
          },
        ],
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: {
                amount: 500,
                currency: "usd",
              },
              display_name: "Delivery",
              tax_behavior: "exclusive",
              tax_code: "txcd_92010001",
            },
          },
        ],
        mode: "payment",
        automatic_tax: { enabled: true },
        billing_address_collection: "required",
        shipping_address_collection: {
          allowed_countries: ["US"],
        },
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
      });

      const testSession2 = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Test Item",
                tax_code: "txcd_10000000",
              },
              unit_amount: 1000,
              tax_behavior: "exclusive",
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Delivery Tip",
                tax_code: "txcd_90020001",
              },
              unit_amount: 200,
              tax_behavior: "exclusive",
            },
            quantity: 1,
          },
        ],
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: {
                amount: 500,
                currency: "usd",
              },
              display_name: "Delivery",
              tax_behavior: "exclusive",
              tax_code: "txcd_92010001",
            },
          },
        ],
        mode: "payment",
        automatic_tax: { enabled: true },
        billing_address_collection: "required",
        shipping_address_collection: {
          allowed_countries: ["US"],
        },
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
      });

      res.json({
        success: true,
        message: "Tax calculation tests created successfully",
        tests: {
          without_tip: {
            session_id: testSession1.id,
            url: testSession1.url,
            automatic_tax_enabled: testSession1.automatic_tax?.enabled,
            description:
              "Test with items + shipping, no tip - should tax both items and shipping",
          },
          with_tip: {
            session_id: testSession2.id,
            url: testSession2.url,
            automatic_tax_enabled: testSession2.automatic_tax?.enabled,
            description:
              "Test with items + shipping + tip - should tax items and shipping, but not tip",
          },
        },
      });
    } catch (error) {
      // // console.error("Tax calculation test failed:", error);
      res.status(400).json({
        success: false,
        error: error.message,
        details:
          "This might indicate that automatic tax is not properly configured in your Stripe dashboard",
      });
    }
  },

  CancelCheckout: async (req, res) => {
    try {
      const { orderID } = req.body;

      if (!orderID) {
        return res.status(400).json({
          message: "orderID are required",
        });
      }
      const order = await productRequest.findOne({ orderId: orderID });

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      order.paymentStatus = "Failed";
      await order.save();

      return responseg.ok(res, {
        message: "Payment Failed",
      });
    } catch (error) {
      // // console.error("Stripe Retrieve Error:", error);
      res.status(400).json({ error: error.message });
    }
  },

  updatePaymentSatusBySeller: async (req, res) => {
    try {
      const { orderId, paymentStatus } = req.body;

      if (!orderId) {
        return res.status(400).json({
          message: "orderID are required",
        });
      }
      const order = await productRequest.findOne({ orderId });

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      order.paymentStatus = paymentStatus;

      for (const productItem of order.productDetail) {
        const product = await Product.findById(productItem.product);

        if (!product) {
          return responseg.error(
            res,
            `Product not found: ${productItem.product}`
          );
        }

        if (product.Quantity - productItem.qty < 0) {
          return responseg.error(
            res,
            `Insufficient stock for product: ${product.name}. Available: ${product.Quantity}, Requested: ${productItem.qty}`
          );
        }
      }
      await Promise.all(
        order.productDetail.map(async (productItem) => {
          await Product.findByIdAndUpdate(
            productItem.product,
            {
              $inc: {
                sold_pieces: productItem.qty,
                Quantity: -productItem.qty, // Decrease available quantity
              },
            },
            { new: true }
          );
        })
      );

      await order.save();

      if (paymentStatus === "Succeeded") {
        const user = await User.findById(order?.user);
        await mailNotification.order({
          email: user.email,
          orderId: order.orderId,
        });

        await notify(
          user,
          "Order Placed",
          `Your order with ID ${order.orderId} has been received.`,
          order.orderId
        );
      }

      return responseg.ok(res, {
        message: "Payment Failed",
        data: order,
      });
    } catch (error) {
      // // console.error("Stripe Retrieve Error:", error);
      res.status(400).json({ error: error.message });
    }
  },
};
