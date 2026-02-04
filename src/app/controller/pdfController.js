const mongoose = require("mongoose");
const ProductRequest = mongoose.model("ProductRequest");
const { decryptObject } = require("../../middlewares/codeDecript");

const pdfController = {
  createPickListPdf: async (req, res) => {
    try {
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
      }

      const order = await ProductRequest.findById(orderId)
        .populate("user", "-password")
        .populate("productDetail.product")
        .lean();

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      let user = decryptObject(order.user);
      order.user = user;

      const PDFDocument = require("pdfkit");
      const doc = new PDFDocument({ margin: 30, size: "A4" });

      // Set up buffer collection
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));

      const pdfPromise = new Promise((resolve) => {
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
      });

      // Page dimensions
      const pageWidth = doc.page.width;
      const margin = 30;
      const contentWidth = pageWidth - (margin * 2);

     
      doc.rect(0, 0, pageWidth, 120).fill('white');
      
      // Add BHH FOOD header without background (like invoice design)
      doc.fontSize(28).font('Helvetica-Bold').fillColor('#f38529');
      doc.text('BHH FOOD', margin, 35);
      
      doc.fontSize(16).font('Helvetica').fillColor('#f38529');
      doc.text('www.bhhfood.com', margin, 60);

      // Pick List header (right side) with invoice-style box
      const infoBoxX = pageWidth - 220;
      const infoBoxY = 30;
      
      // Remove invoice info box
      // doc.rect(infoBoxX, infoBoxY, 180, 140).stroke();
      
      // Remove Page 1 of 1 and PICK LIST text
      // doc.fontSize(12).font('Helvetica-Bold').fillColor('black');
      // doc.text('Page 1 of 1', infoBoxX + 10, infoBoxY + 10);
      // doc.text('PICK LIST', infoBoxX + 10, infoBoxY + 25);
      // doc.fontSize(10).font('Helvetica').text('Grocery', infoBoxX + 10, infoBoxY + 40);
      
      // Simple order information layout (no box) - Order: Type → ID → Date → Pickup Date
      const infoStartX = pageWidth - 220;
      const infoStartY = 35;
      
      // Determine order type first
      let orderType = "Store Pickup";
      if (order.isLocalDelivery) orderType = "Local Delivery";
      if (order.isShipmentDelivery) orderType = "Shipment Delivery";
      if (order.isDriveUp) orderType = "Curbside Pickup";
      
      doc.fontSize(10).font('Helvetica');
      
      // 1. Order Type (first, with orange color)
      doc.fillColor('#f38529').font('Helvetica-Bold');
      doc.text(`Order Type: ${orderType}`, infoStartX, infoStartY);
      
      // 2. Order ID (second)
      doc.fillColor('black').font('Helvetica');
      doc.text(`Order ID: ${order.orderId || order._id.toString().slice(-8)}`, infoStartX, infoStartY + 15);
      
      // 3. Order Date with time (third)
      const orderDateTime = new Date(order.createdAt);
      const dateStr = orderDateTime.toLocaleDateString('en-US', {
        timeZone: 'America/Chicago' // Houston, TX is in Central Time
      });
      const timeStr = orderDateTime.toLocaleTimeString('en-US', {
        timeZone: 'America/Chicago', // Houston, TX is in Central Time
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      doc.text(`Order Date: ${dateStr} ${timeStr}`, infoStartX, infoStartY + 30);
      
      // 4. Pickup Date (fourth, if exists)
      if (order.dateOfDelivery) {
        const pickupDate = new Date(order.dateOfDelivery).toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'long', 
          year: 'numeric'
        });
        doc.text(`Pickup Date: ${pickupDate}`, infoStartX, infoStartY + 45);
      }

      // Customer details section (left side)
      doc.fontSize(10).font('Helvetica').fillColor('black');
      doc.text(`Customer: ${user.username || 'Customer Name'}`, margin, 90);
      doc.text(`Phone: ${user.number || 'N/A'}`, margin, 105);
      doc.text(`Email: ${user.email || 'N/A'}`, margin, 120);
      
      // Add address after email
      let addressY = 135;
      if (order.Local_address) {
        const address = order.Local_address.address || '';
        const cityStateZip = `${order.Local_address.city || ''} ${order.Local_address.state || ''} ${order.Local_address.zipcode || ''}`.trim();
        
        if (address) {
          doc.text(`Address: ${address}`, margin, addressY);
          addressY += 15;
        }
        if (cityStateZip) {
          doc.text(`${cityStateZip}`, margin, addressY);
          addressY += 15;
        }
      } else if (order.Shipment_address) {
        const address = order.Shipment_address.address || '';
        const cityStateZip = `${order.Shipment_address.city || ''} ${order.Shipment_address.state || ''} ${order.Shipment_address.zipcode || ''}`.trim();
        
        if (address) {
          doc.text(`Address: ${address}`, margin, addressY);
          addressY += 15;
        }
        if (cityStateZip) {
          doc.text(`${cityStateZip}`, margin, addressY);
          addressY += 15;
        }
      }

      // Add barcode after customer details (adjust position based on address)
      const barcodeY = Math.max(160, addressY + 10); // Ensure barcode is below address
      try {
        const barcodeLib = require('bwip-js');
        const barcodeBuffer = await barcodeLib.toBuffer({
          bcid: 'code128',
          text: order.orderId || order._id.toString(),
          scale: 3,
          height: 10,
          includetext: true,
          textxalign: 'center',
          textsize: 10,
          textyoffset: -2,
        });
        doc.image(barcodeBuffer, margin, barcodeY, { width: 200, height: 65 });
      } catch (barcodeError) {
        console.log('Barcode generation failed, using text fallback');
        doc.fontSize(10).text(`Order ID: ${order.orderId || order._id.toString()}`, margin, barcodeY);
      }

      // S.O.# section - moved down to accommodate barcode with proper spacing
      // doc.fontSize(10).font('Helvetica');
      // doc.text(`S.O.# ${order.orderId || order._id.toString().slice(-8)}`, margin, 240);
      // doc.text('PO# BACH HOA HOUSTON', margin, 255);
      // doc.text('TX', margin, 270);

      // Customer pickup info
      doc.fontSize(8);
      // doc.text(`Remarks: From Order # ${order.orderId || order._id.toString().slice(-8)} CUSTOMER PICK UP FRIDAY`, margin, 290);

      // Table headers
      const tableStartY = 260;
      doc.fontSize(8).font('Helvetica-Bold');
      
      // Draw table header background (no borders)
      doc.rect(margin, tableStartY, contentWidth, 20).fill('#f0f0f0');
      
      // Table column headers (no vertical lines)
      doc.fillColor('black');
      doc.text('CHECKED', margin + 5, tableStartY + 5);
      doc.text('PICKED', margin + 60, tableStartY + 5);
      doc.text('REL QTY', margin + 110, tableStartY + 5);
      doc.text('WH', margin + 190, tableStartY + 5);
      doc.text('BIN', margin + 230, tableStartY + 5);
      doc.text('ITEM - UOM', margin + 280, tableStartY + 5);
      doc.text('PRICE', margin + 400, tableStartY + 5);
      doc.text('BATCH#', margin + 460, tableStartY + 5);

      // Table rows
      let currentY = tableStartY + 25;
      doc.fontSize(8).font('Helvetica');

      // Product rows
      order.productDetail.forEach((item, index) => {
        const product = item.product;
        const rowHeight = 35;

        // Draw row background (alternating)
        if (index % 2 === 0) {
          doc.rect(margin, currentY - 5, contentWidth, rowHeight).fill('#f9f9f9');
        }

        doc.fontSize(8).font('Helvetica').fillColor('black');
        
        // REL QTY with UOM (quantity WITH unit) - moved slightly right
        // Debug: Log product structure to find correct unit field
        console.log('Product data:', {
          itemUOM: product?.itemUOM,
          unit: product?.unit,
          price_slot_unit: product?.price_slot?.[0]?.unit,
          varients_unit: product?.varients?.[0]?.unit,
          productName: product?.name
        });
        
        // Try to get unit from price_slot first, then varients, then itemUOM
        const itemUOM = product?.price_slot?.[0]?.unit || product?.varients?.[0]?.unit || product?.itemUOM || 'EACH';
        doc.text(`${item.qty} ${itemUOM}`, margin + 120, currentY + 5, {
          width: 70,
          align: 'left'
        });
        
        // Dynamic WH (warehouse) from product
        const warehouse = product?.warehouse || 'WH01';
        doc.text(warehouse, margin + 190, currentY + 5, { 
          width: 30, 
          align: 'left' 
        });
        
        // Dynamic BIN from product  
        const bin = product?.bin || `BIN-${index + 1}`;
        doc.text(bin, margin + 230, currentY + 5, { 
          width: 40, 
          align: 'left' 
        });

        // Product name WITH itemUOM in ITEM - UOM column
        const productName = product?.name || product?.vietnamiesName || 'Product Name';
        const cleanProductName = productName.toString().replace(/[^\x00-\x7F]/g, "").trim() || 'Product Name';
        const productItemUOM = product?.itemUOM || '';
        
        // Combine product name with itemUOM if itemUOM exists
        const displayText = productItemUOM ? `${cleanProductName} - ${productItemUOM}` : cleanProductName;
        
        doc.fontSize(8).text(displayText, margin + 280, currentY + 5, {
          width: 110,
          align: 'left'
        });

        // Price with $ sign
        doc.text(`$${item.price || item.total}`, margin + 400, currentY + 5);

        // Batch number
        const batchNumber = product?.batchNumber || order.orderId || order._id.toString().slice(-8);
        doc.text(batchNumber, margin + 460, currentY + 5);

        currentY += rowHeight;
      });

      // Add total row at the end of table
      const totalProducts = order.productDetail.length;
      let totalPrice = 0;
      let totalQuantity = 0;
      
      // Calculate totals
      order.productDetail.forEach((item) => {
        totalPrice += parseFloat(item.price || item.total || 0) * parseInt(item.qty || 1);
        totalQuantity += parseInt(item.qty || 1);
      });

      // Draw total row with background
      const totalRowHeight = 25;
      // Remove the table row background - we'll put totals below table instead
      // doc.rect(margin, currentY - 5, contentWidth, totalRowHeight).fill('#e8f4f8');
      
      doc.fontSize(9).font('Helvetica-Bold').fillColor('black');
      
      // Total quantity in REL QTY column
      // doc.text(`${totalQuantity}`, margin + 120, currentY + 10, {
      //   width: 70,
      //   align: 'left'
      // });
      
      // "TOTAL" text in ITEM - UOM column
      // doc.text('TOTAL', margin + 280, currentY + 10, {
      //   width: 110,
      //   align: 'left'
      // });
      
      // Total price in PRICE column
      // doc.text(`$${totalPrice.toFixed(2)}`, margin + 400, currentY + 10);
      
      // Total products count in BATCH# column
      // doc.text(`${totalProducts} items`, margin + 460, currentY + 10);
      
      // currentY += totalRowHeight;

      // Draw bottom border of table
      doc.moveTo(margin, currentY - 5).lineTo(margin + contentWidth, currentY - 5).stroke();

      // Add total row in table format (before bottom border)
      // Fix total row alignment: Total → Quantity → Total Price
      doc.fontSize(9).font('Helvetica-Bold').fillColor('black');
      
      // "Total" text in CHECKED column (first column)
      doc.text('Total', margin + 5, currentY + 5);
      
      // Total quantity in REL QTY column (second)
      doc.text(`${totalQuantity}`, margin + 120, currentY + 5, {
        width: 70,
        align: 'left'
      });
      
      // Total price in PRICE column (third, with $ sign)
      doc.text(`$${totalPrice.toFixed(2)}`, margin + 400, currentY + 5);
      
      currentY += totalRowHeight;

      // Footer information
      currentY += 20; // Reduced spacing to fit totals better
      doc.fontSize(10).font('Helvetica');

      // Order totals (right side) - Updated to match website design
      const totalsX = pageWidth - 220; // Moved left a bit to fit better
      
      // Calculate subtotal from product details
      let subtotal = 0;
      order.productDetail.forEach((item) => {
        subtotal += parseFloat(item.price) * parseInt(item.qty);
      });
      
     
      doc.fontSize(10).font('Helvetica-Bold');
      doc.rect(totalsX - 10, currentY - 5, 200, 130).stroke(); // Increased height back to 120
      // Remove ORDER TOTALS text
      currentY += 10; // Reduced spacing
      
      doc.fontSize(9).font('Helvetica');
      doc.text(`Subtotal:`, totalsX, currentY);
      doc.text(`$${subtotal.toFixed(2)}`, totalsX + 80, currentY);
      
      doc.text(`Total Tax:`, totalsX, currentY + 15);
      doc.text(`$${parseFloat(order.totalTax || 0).toFixed(2)}`, totalsX + 80, currentY + 15);
      
      doc.text(`Total Tip:`, totalsX, currentY + 30);
      doc.text(`$${parseFloat(order.Deliverytip || 0).toFixed(2)}`, totalsX + 80, currentY + 30);
      
      doc.text(`Delivery Fee:`, totalsX, currentY + 45);
      doc.text(`$${parseFloat(order.deliveryfee || 0).toFixed(2)}`, totalsX + 80, currentY + 45);
      
      doc.text(`Service Fee:`, totalsX, currentY + 60);
      doc.text(`$${parseFloat(order.serviceFee || 0).toFixed(2)}`, totalsX + 80, currentY + 60);
      
      doc.text(`Discount:`, totalsX, currentY + 75);
      doc.text(`-$${parseFloat(order.discount || 0).toFixed(2)}`, totalsX + 80, currentY + 75);
      
      // Calculate final total
      const finalTotal = subtotal + 
                        parseFloat(order.totalTax || 0) + 
                        parseFloat(order.Deliverytip || 0) + 
                        parseFloat(order.deliveryfee || 0) + 
                        parseFloat(order.serviceFee || 0) - 
                        parseFloat(order.discount || 0);
      
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text(`Total:`, totalsX, currentY + 95);
      doc.text(`$${finalTotal.toFixed(2)}`, totalsX + 80, currentY + 95);

      doc.end();

      const pdfBuffer = await pdfPromise;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=bachhoahouston-picklist-${orderId}.pdf`
      );

      res.send(pdfBuffer);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      return res
        .status(500)
        .json({ message: "Error generating PDF", error: error.message });
    }
  }
};

module.exports = pdfController;
