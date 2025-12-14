const fs = require('fs');

const collection = {
  info: {
    name: "NEWS NEXT API",
    description: "Backend API for NEWS NEXT - Edizione Calabria",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  item: [
    {
      name: "Auth",
      item: [
        {
          name: "Register",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "admin@example.com", password: "password123", name: "Admin User", role: "ADMIN" })
            },
            url: { raw: "{{baseUrl}}/auth/register", host: ["{{baseUrl}}"], path: ["auth", "register"] }
          }
        },
        {
          name: "Login",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({ email: "admin@example.com", password: "password123" })
            },
            url: { raw: "{{baseUrl}}/auth/login", host: ["{{baseUrl}}"], path: ["auth", "login"] }
          },
          event: [
            {
              listen: "test",
              script: {
                exec: [
                  "var jsonData = pm.response.json();",
                  "pm.environment.set('token', jsonData.data.token);"
                ],
                type: "text/javascript"
              }
            }
          ]
        },
        {
          name: "Get Me",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{token}}" }],
            url: { raw: "{{baseUrl}}/auth/me", host: ["{{baseUrl}}"], path: ["auth", "me"] }
          }
        },
        {
            name: "Forgot Password",
            request: {
                method: "POST",
                header: [{ key: "Content-Type", value: "application/json" }],
                body: { mode: "raw", raw: JSON.stringify({ email: "admin@example.com" }) },
                url: { raw: "{{baseUrl}}/auth/forgot-password", host: ["{{baseUrl}}"], path: ["auth", "forgot-password"] }
            }
        }
      ]
    },
    {
      name: "Public / Website",
      item: [
        {
          name: "Get All Categories",
          request: {
            method: "GET",
            url: { raw: "{{baseUrl}}/categories", host: ["{{baseUrl}}"], path: ["categories"] }
          }
        },
        {
          name: "Get News (Public)",
          request: {
            method: "GET",
            url: { raw: "{{baseUrl}}/news", host: ["{{baseUrl}}"], path: ["news"] }
          }
        },
        {
          name: "Get TG News (Video)",
          request: {
            method: "GET",
            url: { raw: "{{baseUrl}}/tg", host: ["{{baseUrl}}"], path: ["tg"] }
          }
        },
        {
          name: "Get Weather Cities",
          request: {
            method: "GET",
            url: { raw: "{{baseUrl}}/weather/cities", host: ["{{baseUrl}}"], path: ["weather", "cities"] }
          }
        },
        {
          name: "Get Daily Horoscope",
          request: {
            method: "GET",
            url: { raw: "{{baseUrl}}/horoscope/daily", host: ["{{baseUrl}}"], path: ["horoscope", "daily"] }
          }
        },
        {
          name: "Get Transport Directory",
          request: {
            method: "GET",
            url: { raw: "{{baseUrl}}/transport", host: ["{{baseUrl}}"], path: ["transport"] }
          }
        },
        {
          name: "Search",
          request: {
            method: "GET",
            url: { raw: "{{baseUrl}}/search?q=calabria", host: ["{{baseUrl}}"], path: ["search"], query: [{ key: "q", value: "calabria" }] }
          }
        },
        {
          name: "Subscribe Newsletter",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: { mode: "raw", raw: JSON.stringify({ email: "subscriber@example.com" }) },
            url: { raw: "{{baseUrl}}/newsletter/subscribe", host: ["{{baseUrl}}"], path: ["newsletter", "subscribe"] }
          }
        },
         {
          name: "Submit Report",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: { mode: "raw", raw: JSON.stringify({ content: "I saw something happening...", contactInfo: "John Doe" }) },
            url: { raw: "{{baseUrl}}/reports", host: ["{{baseUrl}}"], path: ["reports"] }
          }
        }
      ]
    },
    {
      name: "Admin Panel",
      item: [
        {
          name: "Get Dashboard Stats",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{token}}" }],
            url: { raw: "{{baseUrl}}/stats", host: ["{{baseUrl}}"], path: ["stats"] }
          }
        },
        {
          name: "Manage Users - List",
          request: {
            method: "GET",
            header: [{ key: "Authorization", value: "Bearer {{token}}" }],
            url: { raw: "{{baseUrl}}/users", host: ["{{baseUrl}}"], path: ["users"] }
          }
        },
        {
          name: "Assign Category to Editor",
          request: {
            method: "POST",
            header: [{ key: "Authorization", value: "Bearer {{token}}" }, { key: "Content-Type", value: "application/json" }],
            body: { mode: "raw", raw: JSON.stringify({ categoryIds: ["UUID_HERE"] }) },
            url: { raw: "{{baseUrl}}/users/:id/categories", host: ["{{baseUrl}}"], path: ["users", ":id", "categories"], variable: [{ key: "id", value: "USER_ID" }] }
          }
        },
        {
            name: "Create News",
            request: {
                method: "POST",
                header: [{ key: "Authorization", value: "Bearer {{token}}" }, { key: "Content-Type", value: "application/json" }],
                body: { 
                    mode: "raw", 
                    raw: JSON.stringify({ 
                        title: "New Project Launch", 
                        slug: "new-project-launch", 
                        summary: "Summary here", 
                        content: "Full content here...", 
                        categoryId: "CAT_UUID",
                        status: "PUBLISHED"
                    }) 
                },
                url: { raw: "{{baseUrl}}/news", host: ["{{baseUrl}}"], path: ["news"] }
            }
        },
        {
            name: "Manage Ads - List",
            request: {
                method: "GET",
                header: [{ key: "Authorization", value: "Bearer {{token}}" }],
                url: { raw: "{{baseUrl}}/ads", host: ["{{baseUrl}}"], path: ["ads"] }
            }
        },
        {
            name: "Social Connect",
            request: {
                method: "POST",
                header: [{ key: "Authorization", value: "Bearer {{token}}" }, { key: "Content-Type", value: "application/json" }],
                body: { mode: "raw", raw: JSON.stringify({ platform: "FACEBOOK", token: "access_token", accountId: "123", name: "My Page" }) },
                url: { raw: "{{baseUrl}}/social/connect", host: ["{{baseUrl}}"], path: ["social", "connect"] }
            }
        }
      ]
    }
  ],
  variable: [
    {
      key: "baseUrl",
      value: "http://localhost:3001/api",
      type: "string"
    }
  ]
};

fs.writeFileSync('NEWS_NEXT_Postman_Collection.json', JSON.stringify(collection, null, 2));
console.log("Postman collection generated at NEWS_NEXT_Postman_Collection.json");

