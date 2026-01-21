const CryptoJS = require("crypto-js");

const SECRET = process.env.CRYPTO_SECRET;

const isEncrypted = (value) => {
    return (
        typeof value === "string" &&
        value.startsWith("U2FsdGVkX1")
    );
}


const decryptSingleValue = (value) => {
    if (!value || typeof value !== "string" || !isEncrypted(value)) return value;

    try {
        const bytes = CryptoJS.AES.decrypt(value, SECRET);
        const text = bytes.toString(CryptoJS.enc.Utf8);
        let v = unwrapValue(text || value)
        return v;
    } catch {
        let v = unwrapValue(value)
        return v;
    }
};

const decryptSingleObject = (obj) => {
    const decryptedObj = {};
    // // console.log(obj)
    for (const key in obj) {
        if (key === "user_first_name") {
            decryptedObj['username'] = unwrapValue(decryptSingleValue(obj[key]));
        } else if (key === "user_last_name") {
            decryptedObj['lastname'] = unwrapValue(decryptSingleValue(obj[key]));
        } else if (key === "user_email") {
            decryptedObj['email'] = unwrapValue(decryptSingleValue(obj[key]));
        } else if (key === "user_phone") {
            decryptedObj['number'] = unwrapValue(decryptSingleValue(obj[key]));
        } else {
            decryptedObj[key] = unwrapValue(obj[key]);
        }
    }

    return decryptedObj;
};
const unwrapValue = (value) => {
    if (typeof value !== "string") return value;

    // Detect JSON string like: "\"text\""
    if (
        value.startsWith('"') &&
        value.endsWith('"')
    ) {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    return value;
};




module.exports = {

    hashValue: (value) => {
        return CryptoJS.SHA256(
            value.toLowerCase() + SECRET
        ).toString(CryptoJS.enc.Hex);
    },

    encryptData: (data) => {
        if (isEncrypted(data)) return data;
        return CryptoJS.AES.encrypt(
            data,
            SECRET
        ).toString();
    },

    decryptValue: (value) => {
        if (!value || typeof value !== "string" || !isEncrypted(value)) return value;

        try {
            const bytes = CryptoJS.AES.decrypt(value, SECRET);
            const text = bytes.toString(CryptoJS.enc.Utf8);
            let v = unwrapValue(text || value)
            return v;
        } catch {
            let v = unwrapValue(value)
            return v;
        }
    },

    decryptObject: (obj) => {
        const decryptedObj = {};
        // // console.log(obj)
        for (const key in obj) {
            if (key === "user_first_name") {
                decryptedObj['username'] = unwrapValue(decryptSingleValue(obj[key]));
            } else if (key === "user_last_name") {
                let lastname = unwrapValue(decryptSingleValue(obj[key]));
                // console.log(lastname, obj[key])
                decryptedObj['lastname'] = lastname
            } else if (key === "user_email") {
                decryptedObj['email'] = unwrapValue(decryptSingleValue(obj[key]));
            } else if (key === "user_phone") {
                decryptedObj['number'] = unwrapValue(decryptSingleValue(obj[key]));
            } else {
                decryptedObj[key] = unwrapValue(obj[key]);
            }
        }

        return decryptedObj;
    },

    decryptArray: (dataArray, key) => {
        return dataArray.map(async item => {
            if (item[key]) {
                item[key] = await decryptSingleObject(item[key])
            }
            return item
        }
        );
    },

    decryptArraywithoutKey: (arr = []) => {
        // // console.log(dataArray)
        if (!Array.isArray(arr)) return [];

        return arr.map(item => decryptSingleObject(item.toObject ? item.toObject() : item));
    },



    decryptPopulatedData: (list, populatedKey) => {
        return list.map(item => {
            const populated = item[populatedKey];

            // ✅ CASE 1: populated is ARRAY
            if (Array.isArray(populated)) {
                item[populatedKey] = populated.map(obj => {
                    const decryptedObj = { ...obj };

                    for (const key in decryptedObj) {
                        if (key === "user_first_name") {
                            decryptedObj['username'] = unwrapValue(decryptSingleValue(decryptedObj[key]));
                            delete decryptedObj[key]
                        }
                        if (key === "user_last_name") {
                            decryptedObj['lastname'] = unwrapValue(decryptSingleValue(decryptedObj[key]));
                            delete decryptedObj[key]
                        }
                        if (key === "user_email") {
                            decryptedObj['email'] = unwrapValue(decryptSingleValue(decryptedObj[key]));
                            delete decryptedObj[key]
                        }
                        if (key === "user_phone") {
                            decryptedObj['number'] = unwrapValue(decryptSingleValue(decryptedObj[key]));
                            delete decryptedObj[key]
                        }


                    }
                    return decryptedObj;
                });
            }

            // ✅ CASE 2: populated is OBJECT
            else if (populated && typeof populated === "object") {
                const decryptedObj = { ...populated };
                for (const key in decryptedObj) {
                    // // console.log(key)
                    if (key === "user_first_name") {
                        decryptedObj['username'] = unwrapValue(decryptSingleValue(decryptedObj[key]));
                        delete decryptedObj[key]
                    }
                    if (key === "user_last_name") {
                        decryptedObj['lastname'] = unwrapValue(decryptSingleValue(decryptedObj[key]));
                        delete decryptedObj[key]
                    }
                    if (key === "user_email") {
                        decryptedObj['email'] = unwrapValue(decryptSingleValue(decryptedObj[key]));
                        delete decryptedObj[key]
                    }
                    if (key === "user_phone") {
                        decryptedObj['number'] = unwrapValue(decryptSingleValue(decryptedObj[key]));
                        delete decryptedObj[key]
                    }
                    delete decryptedObj[key]
                }
                item[populatedKey] = decryptedObj;
            }

            return item;
        });
    }
}