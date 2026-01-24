const mongoose = require("mongoose");
const ProductRequest = mongoose.model("ProductRequest");
const { decryptObject } = require("../../middlewares/codeDecript");

const pdfController = {
  createPickListPdf: async (req, res) => {
    try {
      const { orderId, lang } = req.body;

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
      const logoPath = path.join(__dirname, '../../public', 'newlogo.jpeg');
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

      // S.O.# section
      doc.fontSize(10).font('Helvetica');
      doc.text(`S.O.# ${order.orderId || order._id.toString().slice(-8)}`, margin, 180);
      doc.text('PO# BACH HOA HOUSTON', margin, 195);
      doc.text('TX', margin, 210);

      // Customer pickup info
      doc.fontSize(8);
      doc.text(`Remarks: From Order # ${order.orderId || order._id.toString().slice(-8)} CUSTOMER PICK UP FRIDAY`, margin, 240);

      // Table headers
      const tableStartY = 270;
      doc.fontSize(8).font('Helvetica-Bold');
      
      // Draw table header background (no borders)
      doc.rect(margin, tableStartY, contentWidth, 20).fill('#f0f0f0');
      
      // Table column headers (no vertical lines)
      doc.fillColor('black');
      doc.text('CHECKED', margin + 5, tableStartY + 5);
      doc.text('PICKED', margin + 60, tableStartY + 5);
      doc.text('REL QTY', margin + 110, tableStartY + 5);
      doc.text('WH', margin + 160, tableStartY + 5);
      doc.text('BIN', margin + 200, tableStartY + 5);  // Added more gap from WH
      doc.text('ITEM - UOM', margin + 250, tableStartY + 5);
      doc.text('PRICE', margin + 370, tableStartY + 5);  // Moved slightly right
      doc.text('BATCH#', margin + 430, tableStartY + 5); // Moved slightly right

      // NO vertical lines at all - completely removed

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

        // NO vertical lines for product rows - removed for cleaner look

        // CHECKED and PICKED fields - keep blank as requested
        doc.fontSize(8).font('Helvetica').fillColor('black');
        // No text for CHECKED column (blank)
        // No text for PICKED column (blank)

        // Product details with dynamic data
        doc.fontSize(8).font('Helvetica').fillColor('black');
        doc.text(item.qty.toString(), margin + 120, currentY + 5); // REL QTY
        
        // Dynamic WH (warehouse) from product
        const warehouse = product?.warehouse || 'WH01';
        doc.text(warehouse, margin + 160, currentY + 5, { 
          width: 30, 
          align: 'left' 
        });
        
        // Dynamic BIN from product  
        const bin = product?.bin || `BIN-${index + 1}`;
        doc.text(bin, margin + 200, currentY + 5, { 
          width: 40, 
          align: 'left' 
        });

        // Product name and UOM (Item - UOM)
        const productName = product?.name || product?.vietnamiesName || 'Product Name';
        const itemUOM = product?.itemUOM || 'EACH';
        
        // Clean product name - remove any encoding issues
        const cleanProductName = productName.toString().replace(/[^\x00-\x7F]/g, "").trim() || 'Product Name';
        
        // Show product name with UOM in ITEM-UOM column
        doc.fontSize(8).text(`${cleanProductName} - ${itemUOM}`, margin + 255, currentY + 5, {
          width: 160, // Increased width for better product name display
          align: 'left'
        });

        // Price (moved slightly right)
        doc.text(`$${item.price || item.total}`, margin + 375, currentY + 5);

        // Batch number (dynamic from product or order)
        const batchNumber = product?.batchNumber || order.orderId || order._id.toString().slice(-8);
        doc.text(batchNumber, margin + 435, currentY + 5);

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
      doc.text(`Subtotal: $${order.total || '0.00'}`, totalsX, currentY);
      doc.text(`Delivery Fee: $${order.deliveryfee || '0.00'}`, totalsX, currentY + 15);
      doc.text(`Tip: $${order.Deliverytip || '0.00'}`, totalsX, currentY + 30);
      doc.text(`Discount: $${order.discount || '0.00'}`, totalsX, currentY + 45);
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text(`Total: $${order.total || '0.00'}`, totalsX, currentY + 60);

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