import { v2 as cloudinary } from 'cloudinary'

const cloudinaryUrl = process.env.CLOUDINARY_URL
const cloudName = process.env.CLOUDINARY_CLOUD_NAME
const apiKey = process.env.CLOUDINARY_API_KEY
const apiSecret = process.env.CLOUDINARY_API_SECRET

if (cloudinaryUrl) {
  cloudinary.config({ cloudinary_url: cloudinaryUrl })
} else if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  })
} else {
  console.warn('Cloudinary credentials not configured. Uploads will fail.')
}

export default cloudinary
