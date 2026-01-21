"use strict";
const router = require("express").Router();
const user = require("../../app/controller/user");
const isAuthenticated = require("../../middlewares/isAuthenticated");
const blog = require("../../app/controller/blogs");
const category = require("../../app/controller/category");
const product = require("../../app/controller/product");
const { upload } = require("../../app/services/fileUpload");
const { getStoreById } = require("../../app/controller/store");
const store = require("../../app/controller/store");
const favourite = require("../../app/controller/favourite");
const ContactUs = require("../../app/controller/feedback");
const flashSaleController = require("../../app/controller/sale");
const cron = require("node-cron");
const stripe = require("../../app/controller/Stripe");
const setting = require("../../app/controller/setting");
const shippingCostController = require("../../app/controller/ShippingCost");
const pincodeController = require("../../app/controller/pincodes");
const {
  createContent,
  getContent,
  updateContent,
} = require("../../app/controller/contentManagement");

const couponController = require("../../app/controller/coupan"); // Adjust the path as necessary
const TeamMember = require("../../app/controller/teammember");
const route = require("../../app/controller/route");
const notifications = require("../../app/controller/notifications");

// router.get("/connvertToencryptData", user.createNewUser); // danger Zone
router.post("/login", user.login);
router.post("/loginwithOtp", user.loginwithOtp);
router.post("/verifyOTPForLogin", user.verifyOTPForLogin);
router.post("/signUp", upload.single("document"), user.signUp);
router.post("/sendOTP", user.sendOTP);
router.post("/verifyOTP", user.verifyOTP);
router.post("/changePassword", user.changePassword);
router.post("/user/fileupload", upload.single("file"), user.fileUpload);

router.get("/getuserlist", isAuthenticated(["ADMIN"]), user.getUserList);

router.get(
  "/getDriverList",
  isAuthenticated(["USER", "ADMIN"]),
  user.getDriverList
);
router.get(
  "/getVerifiedDriverList",
  isAuthenticated(["ADMIN", "EMPLOYEE"]),
  user.getVerifiedDriverList
);

router.post("/updateStatus", isAuthenticated(["ADMIN"]), user.updateStatus);
router.get("/getPendingDocuments", isAuthenticated(["ADMIN"]), user.getPendingDocuments);
router.get("/getAllUsersWithDocuments", isAuthenticated(["ADMIN"]), user.getAllUsersWithDocuments);
router.post("/verifyDocument", isAuthenticated(["ADMIN"]), user.verifyDocument);
router.get(
  "/getSellerList",
  isAuthenticated(["USER", "ADMIN"]),
  user.getSellerList
);

router.post(
  "/profile/changePassword",
  isAuthenticated(["USER", "ADMIN"]),
  user.changePasswordProfile
);

router.get(
  "/getProfile",
  isAuthenticated(["USER", "ADMIN", "DRIVER", "EMPLOYEE"]),
  user.getProfile
);
router.post(
  "/updateProfile",
  isAuthenticated(["USER", "ADMIN", "DRIVER", "EMPLOYEE"]),
  user.updateProfile
);

// Device registration routes for push notifications
router.post(
  "/registerDevice",
  isAuthenticated(["USER", "ADMIN", "DRIVER", "EMPLOYEE"]),
  user.registerDevice
);
router.get(
  "/getUserDevices",
  isAuthenticated(["USER", "ADMIN", "DRIVER", "EMPLOYEE"]),
  user.getUserDevices
);
router.post(
  "/removeDevice",
  isAuthenticated(["USER", "ADMIN", "DRIVER", "EMPLOYEE"]),
  user.removeDevice
);

router.post("/createEmployee", isAuthenticated(["ADMIN"]), user.createEmployee);
router.get("/getEmployee", isAuthenticated(["ADMIN"]), user.getEmployeeList);
router.post("/updateEmployee", isAuthenticated(["ADMIN"]), user.updateEmployee);
router.post(
  "/deleteEmployee/:id",
  isAuthenticated(["ADMIN"]),
  user.deleteEmployee
);
router.get(
  "/getEmployeeById/:id",
  isAuthenticated(["ADMIN"]),
  user.getEmployeeById
);

//blogs
router.get("/getblogcategory", blog.getBloggCategory);
router.post(
  "/create-blog",
  // isAuthenticated(["USER", "ADMIN"]),
  blog.createBlog
);
router.get("/get-blog", blog.getBlog);
router.post(
  "/update-blog",
  isAuthenticated(["USER", "ADMIN"]),
  blog.updateBlog
);
router.post("/getBlogById", blog.getBlogById);
router.post("/getBlogByCategory", blog.getBlogByCategory);
router.delete(
  "/delete-blog",
  isAuthenticated(["USER", "ADMIN"]),
  blog.deleteBlog
);

//Category
router.get(
  "/getCategoryById/:id",
  // isAuthenticated(["USER", "ADMIN","EMPLOYEE"]),
  category.getCategoryById
);
router.post(
  "/createCategory",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  category.createCategory
);
router.get(
  "/getCategory",
  // isAuthenticated(["USER", "ADMIN","EMPLOYEE"]),
  category.getCategory
);
router.get(
  "/getPopularCategory",
  // isAuthenticated(["USER", "ADMIN","EMPLOYEE"]),
  category.getPopularCategory
);
router.post(
  "/updateCategory",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  category.updateCategory
);
router.post(
  "/deleteCategory/:id",
  isAuthenticated(["ADMIN", "EMPLOYEE"]),
  category.deleteCategory
);
router.post(
  "/deleteAllCategory",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  category.deleteAllCategory
);

//settings
router.post(
  "/createsetting",
  isAuthenticated(["ADMIN"]),
  setting.createSetting
);
router.get(
  "/getsetting",
  // isAuthenticated(["USER", "ADMIN","EMPLOYEE"]),
  setting.getSetting
);
router.post(
  "/updatesetting",
  isAuthenticated(["ADMIN"]),
  setting.updateSetting
);

router.post(
  "/createTeamMember",
  isAuthenticated(["ADMIN"]),
  TeamMember.createTeamMember
);

router.get("/getTeamMembers", TeamMember.getTeamMembers);
router.get("/getTeamMember/:id", TeamMember.getTeamMemberById);
router.post(
  "/updateTeamMember",
  isAuthenticated(["ADMIN"]),
  TeamMember.updateTeamMember
);
router.delete(
  "/deleteTeamMember/:id",
  isAuthenticated(["ADMIN"]),
  TeamMember.deleteTeamMember
);
router.post("/bulkDeleteTeamMembers", TeamMember.bulkDeleteTeamMembers);

router.post(
  "/giverate",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  user.giverate
);
router.post("/getReview", user.getReview);
router.delete("/deleteReview/:id", user.deleteReview);

//Product
router.get("/getProductById/:id", product.getProductById);
router.get("/getProductByslug/:id", product.getProductByslug);
router.post("/compareProduct", product.compareProduct);
router.get("/getProductbycategory/:id", product.getProductbycategory);
router.get("/getProductBycategoryId", product.getProductBycategoryId);
router.get("/getTopSoldProduct", product.getTopSoldProduct);

// router.get("/updateProductManually", product.updateProductManually);

router.post(
  "/createProduct",
  isAuthenticated(["ADMIN", "EMPLOYEE"]),
  product.createProduct
);
router.get("/getProduct", product.getProduct);
router.get("/getBulkProduct", product.getBulkProduct);
router.get("/getNewArrival", product.getNewArrival);

router.get("/getBulkBuyProduct", product.getBulkBuyProduct);
router.get("/getProductbySale", product.getProductBySale);

router.get("/getSponseredProduct", product.getSponseredProduct);

router.post(
  "/updateProduct",
  isAuthenticated(["ADMIN", "EMPLOYEE"]),
  product.updateProduct
);

router.get(
  "/topselling",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.topselling
);

router.get(
  "/getnewitem",
  isAuthenticated(["USER", "ADMIN"]),
  product.getnewitem
);

router.get("/getcolors", isAuthenticated(["USER", "ADMIN"]), product.getColors);

router.post(
  "/deleteProduct/:id",
  isAuthenticated(["ADMIN", "EMPLOYEE"]),
  product.deleteProduct
);

router.post(
  "/deleteAllProduct",
  isAuthenticated(["ADMIN"]),
  product.deleteAllProduct
);
router.post(
  "/toggleProductStatus/:id",
  isAuthenticated(["ADMIN", "EMPLOYEE"]),
  product.toggleProductStatus
);

router.get(
  "/findDuplicateItems",
  product.findDuplicateItems
);

router.get("/getStoreById/:id", store.getStoreById);
router.post("/createStore", isAuthenticated(["ADMIN"]), store.createStore);
router.get("/getStore", isAuthenticated(["USER", "ADMIN"]), store.getStore);
router.post("/updateStore", isAuthenticated(["ADMIN"]), store.updateStore);

router.delete(
  "/deleteStore/:id",
  isAuthenticated(["ADMIN"]),
  store.deleteStore
);
router.post(
  "/deleteAllStore",
  isAuthenticated(["ADMIN"]),
  store.deleteAllStore
);

// product request
router.post(
  "/createProductRquest",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.requestProduct
);

router.post(
  "/New-createProductRquest",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.newRequestProduct
);

router.post(
  "/SetProductPosition",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.setProductPosition
);

router.post(
  "/BulkMessage",
  isAuthenticated(["ADMIN"]),
  user.sendMessageToAllCustomer
);

router.post(
  "/updateProductRequest",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.updateProductRequest
);

router.get(
  "/getProductRquest",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.getrequestProduct
);

router.get(
  "/getStatusCompletedProducts",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.getStatusCompletedProducts
);

router.post(
  "/getOrderBySeller",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.getOrderBySeller
);

router.post(
  "/NewgetOrderBySeller",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.NewgetOrderBySeller
);
router.post(
  "/delete-order/:orderId",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.DeleteOrder
);

router.get(
  "/FailedOrder",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.FailedOrder
);

router.post(
  "/getAssignedOrder",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.getAssignedOrder
);

router.post(
  "/changeorderstatus",
  isAuthenticated(["ADMIN", "EMPLOYEE"]),
  product.changeorderstatus
);

router.post(
  "/verifyOrderStatusWithCode",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.verifyOrderStatusWithCode
);

router.post(
  "/AddNote",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.AddNote
);

router.get("/productsearch", product.productSearch);
router.get("/updateProductImages", product.updateProductImages);

router.post(
  "/updateProductRequest/:id",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.updaterequestProduct
);

router.get(
  "/getProductRequest/:id",
  isAuthenticated(["USER", "ADMIN", "DRIVER", "EMPLOYEE"]),
  product.getrequestProductbyid
);

router.get(
  "/getProductRequestbyUser",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.getrequestProductbyuser
);

router.get(
  "/NewgetrequestProductbyuser",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.NewgetrequestProductbyuser
);

router.post(
  "/nearbyorderfordriver",
  isAuthenticated(["USER", "ADMIN", "DRIVER"]),
  product.nearbyorderfordriver
);

//Favourite

router.post(
  "/addremovefavourite",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  favourite.AddFavourite
);

router.get(
  "/getFavourite",
  // isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  favourite.getFavourite
);

router.post(
  "/uploadAllproduct",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.uploadProducts
);
router.get(
  "/getLowStockProduct",
  // isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.getLowStockProduct
);

router.get("/getAlluploadproduct", product.uploadProducts);

router.post("/createFeedback", ContactUs.createFeedback);
router.post(
  "/getAllFeedback",
  // isAuthenticated(["USER", "ADMIN", "SELLER"]),
  ContactUs.getAllFeedback
);
router.post("/updateContactStatus", ContactUs.updateStatus);
router.post(
  "/createSale",
  isAuthenticated(["ADMIN"]),
  flashSaleController.createFlashSale
);
router.get(
  "/getFlashSale",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  flashSaleController.getFlashSale
);
router.get("/getActiveFlashSales", flashSaleController.getActiveFlashSales);
router.get(
  "/getFlashSaleByProduct/:productId",
  flashSaleController.getFlashSaleByProduct
);
router.put(
  "/updateFlashSale/:id",
  isAuthenticated(["ADMIN"]),
  flashSaleController.updateFlashSale
);
router.put(
  "/toggleFlashSaleStatus/:id",
  isAuthenticated(["ADMIN"]),
  flashSaleController.toggleFlashSaleStatus
);
router.delete(
  "/deleteFlashSale/:id",
  isAuthenticated(["ADMIN"]),
  flashSaleController.deleteFlashSale
);
router.delete(
  "/deleteAllFlashSales",
  isAuthenticated(["ADMIN"]),
  flashSaleController.deleteAllFlashSales
);
router.delete(
  "/deleteSale",
  isAuthenticated(["ADMIN"]),
  flashSaleController.deleteAllFlashSales
);
router.post(
  "/deleteFlashSaleProduct",
  isAuthenticated(["ADMIN"]),
  flashSaleController.deleteFlashSale
);

router.post(
  "/poststripe",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  stripe.poststripe
);
router.post(
  "/createPayment",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  stripe.createPayment
);
router.post(
  "/create-checkout-session",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  stripe.createCheckout
);
router.post(
  "/retrieve-checkout-session",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  stripe.retrieveCheckout
);
router.post(
  "/test-tax-calculation",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  stripe.testTaxCalculation
);
router.post(
  "/orderreadyNotification",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  user.orderreadyNotification
);
router.post("/getSecrectCode", product.getSecrectCode);
router.post("/updateTrackingInfo", product.updateTrackingInfo);

router.post(
  "/cancalOrder",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.cancalOrder
);

router.post(
  "/cancalOrderfromAdmin",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.cancalOrderfromAdmin
);

router.post(
  "/switchToShipment",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.switchToShipment
);

router.post(
  "/RequestForReturn",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.RequestForReturn
);

router.post(
  "/ReturnConform",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  product.ReturnConform
);

router.post("/suspendUser", isAuthenticated(["ADMIN"]), user.suspendUser);

router.post(
  "/addShippingCost",
  isAuthenticated(["ADMIN"]),
  shippingCostController.addShippingCost
);

router.get(
  "/getShippingCost",
  // isAuthenticated(["USER", "ADMIN","EMPLOYEE"]),
  shippingCostController.getShippingCost
);

router.post(
  "/updateShippingCost",
  isAuthenticated(["ADMIN"]),
  shippingCostController.updateShippingCost
);

router.post(
  "/addPinCode",
  isAuthenticated(["ADMIN"]),
  pincodeController.addPincode
);

router.get("/getPinCode", pincodeController.getAllPincodes);

router.delete(
  "/deletePinCode/:id",
  isAuthenticated(["ADMIN"]),
  pincodeController.deletePincode
);

router.post("/checkAvailable", pincodeController.checkPincodeAvailability);

router.post("/content", isAuthenticated(["ADMIN"]), createContent);

router.get(
  "/content",
  // isAuthenticated(["USER", "ADMIN", "SELLER"]),
  getContent
);

router.post("/content/update", isAuthenticated(["ADMIN"]), updateContent);

router.post(
  "/sendmessage",
  isAuthenticated(["ADMIN"]),
  user.sendMessageToCustomer
);

router.post(
  "/AddCoupon",
  isAuthenticated(["ADMIN"]),
  couponController.AddCoupon
);

router.get("/GetAllCoupons", couponController.GetAllCoupons);

router.post(
  "/validateCoupon",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  couponController.ValidateCoupon
);

router.get(
  "/getCoupanbyId/:id",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  couponController.GetCouponById
);

router.post(
  "/updateCoupan/:id",
  isAuthenticated(["ADMIN"]),
  couponController.UpdateCoupon
);
router.post(
  "/ValidateCouponforUser",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  couponController.ValidateCouponforUser
);

router.delete(
  "/deleteCoupan/:id",
  isAuthenticated(["ADMIN"]),
  couponController.DeleteCoupon
);

router.post("/getCustomerDashboard", user.getCustomerDashboard);

router.post("/getAllCustomersStats", user.getAllCustomersStats);

router.post("/getCustomerOrderHistory", user.getCustomerOrderHistory);
router.get(
  "/orderhistoryfordriver",
  isAuthenticated(["USER", "ADMIN", "DRIVER", "SELLER"]),
  product.orderhistoryfordriver
);
router.get(
  "/acceptedorderfordriver",
  isAuthenticated(["USER", "ADMIN", "DRIVER", "SELLER"]),
  product.acceptedorderfordriver
);
router.post(
  "/getOrderHistoryByAdmin",
  isAuthenticated(["ADMIN"]),
  product.getOrderHistoryByAdmin
);
router.post(
  "/getPendingOrdersByAdmin",
  isAuthenticated(["ADMIN"]),
  product.getPendingOrdersByAdmin
);
router.post("/createinvoice", product.createPdf);
router.post(
  "/assignDriver",
  isAuthenticated(["ADMIN", "EMPLOYEE"]),
  product.assignDriver
);
router.post(
  "/markOrderAsDelivered",
  isAuthenticated(["ADMIN"]),
  product.markOrderAsDelivered
);
router.post(
  "/submitProofOfDelivery",
  isAuthenticated(["ADMIN", "DRIVER"]),
  product.submitProofOfDelivery
);
router.post(
  "/markOrderAsPreparing",
  isAuthenticated(["ADMIN", "DRIVER"]),
  product.markOrderAsPreparing
);
router.post(
  "/acceptorderdriver/:id",
  isAuthenticated(["USER", "ADMIN", "DRIVER", "SELLER"]),
  product.acceptorderdriver
);

// Route management routes
router.post(
  "/optimize-route",
  isAuthenticated(["USER", "ADMIN", "DRIVER", "SELLER"]),
  route.getOptimizedRoute
);
router.get("/dashboarddetails", product.dashboarddetails);
router.get("/getMonthlySales", product.getMonthlySales);

// Notifications
router.get(
  "/getnotification",
  isAuthenticated(["USER", "ADMIN", "DRIVER", "SELLER"]),
  notifications.getNotification
);

// test api
router.post("/test-notification", user.testNotification);

cron.schedule("*/30 * * * * *", () => {
  flashSaleController.DeleteExpiredCoupons();
});
router.post("/changePasswordFOrAdmin", user.changePasswordFOrAdmin);
router.get("/changeBase64", user.changeBase64);

router.get("/downloadProductsExcel", product.downloadProductsExcel);
router.get("/downloadCustomerExcel", user.downloadCustomerExcel);

// sendgrid
// router.get('/send/sendMessageViaSendGrid', user.sendMessageViaSendGrid)
// router.get('/send/sendMessageViaSendGridTemplate', user.sendMessageViaSendGridTemplate)

router.post(
  "/cancel-checkout-session",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  stripe.CancelCheckout
);
router.post(
  "/updatePaymentSatusBySeller",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  stripe.updatePaymentSatusBySeller
);
router.post(
  "/new-retrieve-checkout-session",
  isAuthenticated(["USER", "ADMIN", "EMPLOYEE"]),
  stripe.NewRetrieveCheckout
);

module.exports = router;
