const axios = require("axios");
const mongoose = require("mongoose");
const { decryptPopulatedData } = require("../../middlewares/codeDecript");
const ProductRequest = mongoose.model("ProductRequest");

// const GOOGLE_MAPS_API_KEY = "AIzaSyDHd5FoyP2sDBo0vO2i0Zq7TIUZ_7GhBcI";

// const getDistanceMatrix = async (locations) => {
//   const originStr = locations.map((p) => `${p[1]},${p[0]}`).join("|");
//   const destinationStr = originStr;

//   const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destinationStr}&key=${GOOGLE_MAPS_API_KEY}`;

//   const res = await axios.get(url);
//   return res.data;
// };

// exports.getOptimizedRoute = async (req, res) => {
//   try {
//     const { driver_id, lat, lng } = req.body;

//     if (!driver_id || lat === undefined || lng === undefined) {
//       return res
//         .status(400)
//         .json({ message: "driver_id, lat, and lng are required." });
//     }

//     const deliveries = await ProductRequest.find({
//       driver_id: driver_id,
//     //   status: { $in: ["Driverassigned", "Shipped"] },
//       location: { $exists: true },
//     });

//     if (deliveries.length === 0) {
//       return res.status(404).json({ message: "No deliveries found." });
//     }

//     const deliveryPoints = deliveries.map((doc) => ({
//       id: doc._id,
//       orderId: doc.orderId,
//       coordinates: doc.location.coordinates,
//       doc,
//     }));

//     const allPoints = [
//       { id: "start", coordinates: [parseFloat(lng), parseFloat(lat)] },
//       ...deliveryPoints.map((p) => ({ id: p.id, coordinates: p.coordinates })),
//     ];

//     const matrix = await getDistanceMatrix(allPoints.map((p) => p.coordinates));

//     const distanceMatrix = matrix.rows.map((row) =>
//       row.elements.map((e) => (e.status === "OK" ? e.distance.value : Infinity))
//     );

//     // Nearest neighbor TSP
//     const visited = new Set();
//     let route = [];
//     let currentIndex = 0;

//     while (visited.size < deliveryPoints.length) {
//       visited.add(currentIndex);
//       let nextIndex = -1;
//       let minDistance = Infinity;

//       for (let i = 1; i < allPoints.length; i++) {
//         if (!visited.has(i) && distanceMatrix[currentIndex][i] < minDistance) {
//           minDistance = distanceMatrix[currentIndex][i];
//           nextIndex = i;
//         }
//       }

//       if (nextIndex !== -1) {
//         route.push(allPoints[nextIndex]);
//         currentIndex = nextIndex;
//       } else {
//         break;
//       }
//     }

//     // Map back to original delivery docs
//     const orderedDeliveries = route.map((point, index) => {
//       const match = deliveryPoints.find(
//         (p) => p.id.toString() === point.id.toString()
//       );
//       return {
//         sequence: index + 1,
//         orderId: match?.orderId,
//         coordinates: match?.coordinates,
//         doc: match?.doc,
//       };
//     });

//     res.json({ route: orderedDeliveries });
//   } catch (error) {
//     // console.error("Error optimizing route:", error.message);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

const haversineDistance = (coords1, coords2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;

  const R = 6371; // Radius of Earth in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

exports.getOptimizedRoute = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const driver_id = req.user.id;

    // console.log("Driver ID:", driver_id);
    // console.log("Coordinates:", lat, lng);

    // Validate required parameters
    if (!driver_id || lat === undefined || lng === undefined) {
      return res.status(400).json({
        message: "driver_id, lat, and lng are required.",
      });
    }

    const startCoordinates = [parseFloat(lng), parseFloat(lat)];

    // Find deliveries for the driver, excluding cancelled and completed/delivered orders
    const deliveriesReq = await ProductRequest.find({
      driver_id: driver_id,
      status: { $nin: ["Completed", "Delivered", "Cancel"] },
      "Local_address.location.coordinates": { $exists: true },
    })
      .populate("user");
    let deliveries = decryptPopulatedData(deliveriesReq, 'user');

    if (deliveries.length === 0) {
      return res.status(404).json({
        message: "No deliveries found for this driver.",
      });
    }

    const locations = deliveries.map((d) => ({
      id: d._id,
      orderId: d.orderId,
      coordinates: d.Local_address.location.coordinates || d.location.coordinates,
      original: d,
    }));

    let current = { coordinates: startCoordinates };
    let route = [];
    let remaining = [...locations];

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      remaining.forEach((loc, i) => {
        const dist = haversineDistance(current.coordinates, loc.coordinates);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIndex = i;
        }
      });

      const next = remaining.splice(nearestIndex, 1)[0];
      route.push({
        sequence: route.length + 1,
        coordinates: next.coordinates,
        ...next.original._doc
      });
      current = next;
    }

    res.json({
      success: true,
      route: route,
      totalDeliveries: route.length,
    });
  } catch (error) {
    // console.error("Error optimizing route:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error while optimizing route",
      error: error.message,
    });
  }
};
