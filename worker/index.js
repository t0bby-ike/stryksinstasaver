// Cloudflare Worker for Instagram Scraper
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

// Cache for storing responses
const cache = caches.default

// Rate limiting
const rateLimit = {
  maxRequests: 50,
  interval: 60 * 1000, // 1 minute
  ipMap: new Map(),
}

async function handleRequest(request) {
  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }

  // Rate limiting check
  const clientIP = request.headers.get('CF-Connecting-IP')
  const currentTime = Date.now()

  if (rateLimit.ipMap.has(clientIP)) {
    const clientData = rateLimit.ipMap.get(clientIP)

    // Reset if interval has passed
    if (currentTime - clientData.lastRequestTime > rateLimit.interval) {
      clientData.count = 1
      clientData.lastRequestTime = currentTime
    } else {
      clientData.count++

      if (clientData.count > rateLimit.maxRequests) {
        return new Response(JSON.stringify({
          error: true,
          message: 'Rate limit exceeded. Please try again later.'
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
    }
  } else {
    rateLimit.ipMap.set(clientIP, {
      count: 1,
      lastRequestTime: currentTime
    })
  }

  // Parse request URL
  const url = new URL(request.url)
  const path = url.pathname

  // Handle different endpoints
  try {
    if (path === '/post') {
      return await handlePostRequest(request)
    } else if (path === '/profile') {
      return await handleProfileRequest(request)
    } else if (path === '/stories') {
      return await handleStoriesRequest(request)
    } else if (path === '/reel') {
      return await handleReelRequest(request)
    } else {
      return new Response(JSON.stringify({
        error: true,
        message: 'Endpoint not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  } catch (error) {
    return new Response(JSON.stringify({
      error: true,
      message: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

async function handlePostRequest(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: true,
      message: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  const { url } = await request.json()

  if (!url) {
    return new Response(JSON.stringify({
      error: true,
      message: 'URL is required'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  // Check cache first
  const cacheKey = new Request(`https://cache.insta.com/post?url=${encodeURIComponent(url)}`)
  const cachedResponse = await cache.match(cacheKey)

  if (cachedResponse) {
    return cachedResponse
  }

  // Scrape Instagram post
  const response = await fetch(`https://www.instagram.com/p/${url.split('/p/')[1].split('/')[0]}/?__a=1`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch Instagram post')
  }

  const data = await response.json()
  const mediaItems = []

  // Handle single image post
  if (data.graphql.shortcode_media.__typename === 'GraphImage') {
    mediaItems.push({
      type: 'image',
      url: data.graphql.shortcode_media.display_url
    })
  }
  // Handle video post
  else if (data.graphql.shortcode_media.__typename === 'GraphVideo') {
    mediaItems.push({
      type: 'video',
      url: data.graphql.shortcode_media.video_url
    })
  }
  // Handle carousel post
  else if (data.graphql.shortcode_media.__typename === 'GraphSidecar') {
    data.graphql.shortcode_media.edge_sidecar_to_children.edges.forEach(edge => {
      if (edge.node.__typename === 'GraphImage') {
        mediaItems.push({
          type: 'image',
          url: edge.node.display_url
        })
      } else if (edge.node.__typename === 'GraphVideo') {
        mediaItems.push({
          type: 'video',
          url: edge.node.video_url
        })
      }
    })
  }

  const result = {
    success: true,
    media: mediaItems
  }

  const apiResponse = new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    }
  })

  // Store in cache
  event.waitUntil(cache.put(cacheKey, apiResponse.clone()))

  return apiResponse
}

async function handleProfileRequest(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: true,
      message: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  const { username } = await request.json()

  if (!username) {
    return new Response(JSON.stringify({
      error: true,
      message: 'Username is required'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  // Check cache first
  const cacheKey = new Request(`https://cache.insta.com/profile?username=${encodeURIComponent(username)}`)
  const cachedResponse = await cache.match(cacheKey)

  if (cachedResponse) {
    return cachedResponse
  }

  // Scrape Instagram profile
  const profileResponse = await fetch(`https://www.instagram.com/${username}/?__a=1`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  })

  if (!profileResponse.ok) {
    throw new Error('Failed to fetch Instagram profile')
  }

  const profileData = await profileResponse.json()
  const userId = profileData.graphql.user.id

  // Get profile posts
  const postsResponse = await fetch(`https://www.instagram.com/graphql/query/?query_hash=42323d64886122307be10013ad2dcc44&variables={"id":"${userId}","first":12}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  })

  if (!postsResponse.ok) {
    throw new Error('Failed to fetch profile posts')
  }

  const postsData = await postsResponse.json()
  const mediaItems = []

  // Add profile info as first item
  mediaItems.push({
    type: 'profile',
    profile: {
      username: profileData.graphql.user.username,
      full_name: profileData.graphql.user.full_name,
      avatar: profileData.graphql.user.profile_pic_url_hd,
      posts_count: profileData.graphql.user.edge_owner_to_timeline_media.count,
      followers: profileData.graphql.user.edge_followed_by.count,
      following: profileData.graphql.user.edge_follow.count,
      bio: profileData.graphql.user.biography,
      is_private: profileData.graphql.user.is_private
    }
  })

  // Process posts
  postsData.data.user.edge_owner_to_timeline_media.edges.forEach(edge => {
    const node = edge.node

    if (node.__typename === 'GraphImage') {
      mediaItems.push({
        type: 'image',
        url: node.display_url
      })
    } else if (node.__typename === 'GraphVideo') {
      mediaItems.push({
        type: 'video',
        url: node.video_url
      })
    } else if (node.__typename === 'GraphSidecar') {
      node.edge_sidecar_to_children.edges.forEach(childEdge => {
        if (childEdge.node.__typename === 'GraphImage') {
          mediaItems.push({
            type: 'image',
            url: childEdge.node.display_url
          })
        } else if (childEdge.node.__typename === 'GraphVideo') {
          mediaItems.push({
            type: 'video',
            url: childEdge.node.video_url
          })
        }
      })
    }
  })

  const result = {
    success: true,
    media: mediaItems
  }

  const apiResponse = new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    }
  })

  // Store in cache
  event.waitUntil(cache.put(cacheKey, apiResponse.clone()))

  return apiResponse
}

async function handleStoriesRequest(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: true,
      message: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  const { username } = await request.json()

  if (!username) {
    return new Response(JSON.stringify({
      error: true,
      message: 'Username is required'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  // Check cache first (stories expire quickly)
  const cacheKey = new Request(`https://cache.insta.com/stories?username=${encodeURIComponent(username)}`)
  const cachedResponse = await cache.match(cacheKey)

  if (cachedResponse) {
    return cachedResponse
  }

  // Scrape Instagram stories
  const response = await fetch(`https://www.instagram.com/stories/${username}/?__a=1`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch Instagram stories. User may not have any stories or account is private.')
  }

  const data = await response.json()
  const mediaItems = []

  // Process stories
  data.graphql.user.edge_highlight_reels.edges.forEach(edge => {
    edge.node.items.forEach(item => {
      if (item.__typename === 'GraphStoryImage') {
        mediaItems.push({
          type: 'image',
          url: item.display_url
        })
      } else if (item.__typename === 'GraphStoryVideo') {
        mediaItems.push({
          type: 'video',
          url: item.video_resources[0].src
        })
      }
    })
  })

  const result = {
    success: true,
    media: mediaItems
  }

  const apiResponse = new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300' // Cache for 5 minutes (stories expire quickly)
    }
  })

  // Store in cache
  event.waitUntil(cache.put(cacheKey, apiResponse.clone()))

  return apiResponse
}

async function handleReelRequest(request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      error: true,
      message: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  const { url } = await request.json()

  if (!url) {
    return new Response(JSON.stringify({
      error: true,
      message: 'URL is required'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }

  // Check cache first
  const cacheKey = new Request(`https://cache.insta.com/reel?url=${encodeURIComponent(url)}`)
  const cachedResponse = await cache.match(cacheKey)

  if (cachedResponse) {
    return cachedResponse
  }

  // Scrape Instagram reel
  const response = await fetch(`https://www.instagram.com/reel/${url.split('/reel/')[1].split('/')[0]}/?__a=1`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch Instagram reel')
  }

  const data = await response.json()
  const mediaItems = []

  // Handle reel
  if (data.graphql.shortcode_media.__typename === 'GraphVideo') {
    mediaItems.push({
      type: 'video',
      url: data.graphql.shortcode_media.video_url
    })
  }

  const result = {
    success: true,
    media: mediaItems
  }

  const apiResponse = new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    }
  })

  // Store in cache
  event.waitUntil(cache.put(cacheKey, apiResponse.clone()))

  return apiResponse
}