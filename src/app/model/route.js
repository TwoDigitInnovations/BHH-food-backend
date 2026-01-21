'use strict';

const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["Point"],
        default: "Point"
    },
    coordinates: {
        type: [Number], 
        required: true
    },
});

const deliverySpotSchema = new mongoose.Schema({
    spotId: {
        type: String,
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProductRequest",
        required: true
    },
    location: {
        type: pointSchema,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    deliverySequence: {
        type: Number,
        required: true
    },
    estimatedArrivalTime: {
        type: Date
    },
    actualArrivalTime: {
        type: Date
    },
    status: {
        type: String,
        enum: ["Pending", "In Transit", "Delivered", "Failed", "Skipped"],
        default: "Pending"
    },
    deliveryNotes: {
        type: String
    },
    proofOfDelivery: {
        type: String
    },
    recipient: {
        name: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        email: {
            type: String
        }
    }
});

const routeSchema = new mongoose.Schema({
    routeId: {
        type: String,
        unique: true,
        required: true
    },
    startLocation: {
        type: pointSchema,
        required: true
    },
    startAddress: {
        type: String,
        required: true
    },
    endLocation: {
        type: pointSchema
    },
    endAddress: {
        type: String
    },
    deliverySpots: [deliverySpotSchema],
    optimizedRoute: {
        totalDistance: {
            type: Number // in kilometers
        },
        estimatedDuration: {
            type: Number // in minutes
        },
        routePath: [{
            type: pointSchema
        }]
    },
    status: {
        type: String,
        enum: ["Created", "Assigned", "In Progress", "Completed", "Cancelled", "Paused"],
        default: "Created"
    },
    assignedDate: {
        type: Date,
        default: Date.now
    },
    startTime: {
        type: Date
    },
    endTime: {
        type: Date
    },
    actualDistance: {
        type: Number
    },
    actualDuration: {
        type: Number
    },
    deliveryDate: {
        type: Date,
        required: true
    },
    priority: {
        type: String,
        enum: ["Low", "Medium", "High", "Urgent"],
        default: "Medium"
    },
    vehicle: {
        type: {
            type: String,
            enum: ["Car", "Bike", "Van", "Truck", "Walking"]
        },
        licensePlate: String,
        capacity: Number
    },
    notes: {
        type: String
    },
    isOptimized: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

routeSchema.index({ startLocation: "2dsphere" });
routeSchema.index({ endLocation: "2dsphere" });
routeSchema.index({ "deliverySpots.location": "2dsphere" });

routeSchema.index({ deliveryDate: 1 });
routeSchema.index({ routeId: 1 });

routeSchema.virtual('totalDeliverySpots').get(function() {
    return this.deliverySpots.length;
});

routeSchema.virtual('completedDeliveries').get(function() {
    return this.deliverySpots.filter(spot => spot.status === 'Delivered').length;
});

routeSchema.virtual('progressPercentage').get(function() {
    if (this.deliverySpots.length === 0) return 0;
    return Math.round((this.completedDeliveries / this.totalDeliverySpots) * 100);
});

routeSchema.methods.optimizeDeliverySequence = function() {
    if (this.deliverySpots.length <= 1) return this.deliverySpots;
    
    let optimizedSpots = [];
    let currentLocation = this.startLocation;
    let remainingSpots = [...this.deliverySpots];
    
    while (remainingSpots.length > 0) {
        let nearestSpotIndex = 0;
        let shortestDistance = this.calculateDistance(
            currentLocation.coordinates,
            remainingSpots[0].location.coordinates
        );
        
        for (let i = 1; i < remainingSpots.length; i++) {
            const distance = this.calculateDistance(
                currentLocation.coordinates,
                remainingSpots[i].location.coordinates
            );
            
            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearestSpotIndex = i;
            }
        }
        
        const nearestSpot = remainingSpots.splice(nearestSpotIndex, 1)[0];
        nearestSpot.deliverySequence = optimizedSpots.length + 1;
        optimizedSpots.push(nearestSpot);
        currentLocation = nearestSpot.location;
    }
    
    this.deliverySpots = optimizedSpots;
    this.isOptimized = true;
    return optimizedSpots;
};

routeSchema.methods.calculateDistance = function(coord1, coord2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

routeSchema.methods.addDeliverySpot = function(spotData) {
    const newSpot = {
        ...spotData,
        spotId: `SPOT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        deliverySequence: this.deliverySpots.length + 1
    };
    
    this.deliverySpots.push(newSpot);
    this.isOptimized = false; 
    return newSpot;
};

routeSchema.methods.updateSpotStatus = function(spotId, status, additionalData = {}) {
    const spot = this.deliverySpots.find(s => s.spotId === spotId);
    if (spot) {
        spot.status = status;
        if (status === 'Delivered') {
            spot.actualArrivalTime = new Date();
        }
        Object.assign(spot, additionalData);
        return spot;
    }
    return null;
};

routeSchema.set('toJSON', {
    getters: true,
    virtuals: true,
    transform: (doc, ret, options) => {
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Route', routeSchema);