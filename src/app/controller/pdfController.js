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

      const path = require('path');
      
      // Header Section with Logo
      const logoPath = path.join(__dirname, '../../public', 'newwlogo.png');
      try {
        doc.image(logoPath, margin, 30, { width: 80, height: 40 });
      } catch (logoError) {
        // Fallback to text if logo not found
        doc.fontSize(16).font('Helvetica-Bold').fillColor('black');
        doc.text('BHH', margin, 40);
      }

      // Pick List header (right side) - moved up
      doc.fontSize(14).font('Helvetica-Bold').text('Page 1 of 1', pageWidth - 100, 50);
      doc.text('PICK LIST', pageWidth - 100, 65);
      doc.fontSize(10).font('Helvetica').text('Grocery', pageWidth - 100, 80);

      // Customer details section (left side)
      doc.fontSize(10).font('Helvetica');
      doc.text(`Customer: ${user.username || 'Customer Name'}`, margin, 100);
      doc.text(`Phone: ${user.number || 'N/A'}`, margin, 115);
      doc.text(`Email: ${user.email || 'N/A'}`, margin, 130);

      // Add barcode after customer details
      const barcodeY = 150;
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

      // Pick status box (right side)
      const pickBoxX = pageWidth - 200;
      doc.rect(pickBoxX, 100, 150, 80).stroke();
      doc.fontSize(8).text('PICK STATUS', pickBoxX + 5, 105);
      doc.text('Released', pickBoxX + 5, 120);
      doc.text('PRINT STATUS', pickBoxX + 5, 135);
      doc.text('ORIGINAL', pickBoxX + 5, 150);
      doc.text('PICKED BY', pickBoxX + 5, 165);

      // Date box (next to PRINT STATUS)
      const dateBoxX = pickBoxX + 80;
      doc.rect(dateBoxX, 130, 60, 25).stroke();
      doc.fontSize(8).text('Friday', dateBoxX + 5, 135);
      const currentDate = new Date().toLocaleDateString('en-US');
      doc.text(currentDate, dateBoxX + 5, 145);

      // S.O.# section - moved down to accommodate barcode with proper spacing
      doc.fontSize(10).font('Helvetica');
      doc.text(`S.O.# ${order.orderId || order._id.toString().slice(-8)}`, margin, 230);
      doc.text('PO# BACH HOA HOUSTON', margin, 245);
      doc.text('TX', margin, 260);

      // Customer pickup info
      doc.fontSize(8);
      doc.text(`Remarks: From Order # ${order.orderId || order._id.toString().slice(-8)} CUSTOMER PICK UP FRIDAY`, margin, 285);

      // Table headers
      const tableStartY = 315;
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

        // Price
        doc.text(`${item.price || item.total}`, margin + 400, currentY + 5);

        // Batch number
        const batchNumber = product?.batchNumber || order.orderId || order._id.toString().slice(-8);
        doc.text(batchNumber, margin + 460, currentY + 5);

        currentY += rowHeight;
      });

      // Draw bottom border of table
      doc.moveTo(margin, currentY - 5).lineTo(margin + contentWidth, currentY - 5).stroke();

      // Footer information
      currentY += 30;
      doc.fontSize(10).font('Helvetica');

      if (order.Local_address) {
        doc.text(`Address: ${order.Local_address.address || ''}`, margin, currentY);
        doc.text(`${order.Local_address.city || ''} ${order.Local_address.state || ''} ${order.Local_address.zipcode || ''}`, margin, currentY + 15);
      }

      // Order totals (right side)
      const totalsX = pageWidth - 200;
      doc.text(`Subtotal: ${order.total || '0.00'}`, totalsX, currentY);
      doc.text(`Delivery Fee: ${order.deliveryfee || '0.00'}`, totalsX, currentY + 15);
      doc.text(`Tip: ${order.Deliverytip || '0.00'}`, totalsX, currentY + 30);
      doc.text(`Discount: ${order.discount || '0.00'}`, totalsX, currentY + 45);
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`Total: ${order.total || '0.00'}`, totalsX, currentY + 60);

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
