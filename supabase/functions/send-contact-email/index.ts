import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ContactEmailRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// HTML escape function to prevent XSS attacks
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

// Input validation with length limits
function validateInput(data: ContactEmailRequest): { valid: boolean; error?: string } {
  const { name, email, subject, message } = data;

  // Check required fields
  if (!name || !email || !subject || !message) {
    return { valid: false, error: "All fields are required" };
  }

  // Check field lengths
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    return { valid: false, error: "Name must be between 1 and 100 characters" };
  }

  if (typeof email !== 'string' || email.length > 255) {
    return { valid: false, error: "Email must be less than 255 characters" };
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, error: "Invalid email format" };
  }

  if (typeof subject !== 'string' || subject.trim().length === 0 || subject.length > 200) {
    return { valid: false, error: "Subject must be between 1 and 200 characters" };
  }

  if (typeof message !== 'string' || message.trim().length === 0 || message.length > 5000) {
    return { valid: false, error: "Message must be between 1 and 5000 characters" };
  }

  return { valid: true };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: ContactEmailRequest = await req.json();
    
    // Validate input
    const validation = validateInput(requestData);
    if (!validation.valid) {
      console.log("Validation failed:", validation.error);
      return new Response(
        JSON.stringify({ error: validation.error }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Trim and sanitize inputs
    const name = requestData.name.trim();
    const email = requestData.email.trim().toLowerCase();
    const subject = requestData.subject.trim();
    const message = requestData.message.trim();

    console.log("Received contact form submission from:", email);

    // Escape HTML to prevent XSS in email clients
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

    // Send notification email to the team
    const notificationResponse = await resend.emails.send({
      from: "Avelix Cloud Contact <onboarding@resend.dev>",
      to: ["support@avelix.cloud"],
      subject: `New Contact Form: ${safeSubject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${safeName} (${safeEmail})</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
        <hr />
        <p style="color: #666; font-size: 12px;">This message was sent from the Avelix Cloud website contact form.</p>
      `,
    });

    console.log("Notification email sent successfully");

    // Send confirmation email to the user
    const confirmationResponse = await resend.emails.send({
      from: "Avelix Cloud <onboarding@resend.dev>",
      to: [email],
      subject: "We received your message!",
      html: `
        <h1>Thank you for contacting us, ${safeName}!</h1>
        <p>We have received your message and will get back to you as soon as possible.</p>
        <p><strong>Your message:</strong></p>
        <blockquote style="border-left: 3px solid #3b82f6; padding-left: 15px; color: #666;">
          <p><strong>Subject:</strong> ${safeSubject}</p>
          <p>${safeMessage}</p>
        </blockquote>
        <p>Our team typically responds within 24 hours during business days.</p>
        <p>Best regards,<br>The Avelix Cloud Team</p>
      `,
    });

    console.log("Confirmation email sent successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Your message has been sent successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    // Log detailed error server-side only
    console.error("Error in send-contact-email function:", error);
    
    // Return generic error message to client (no internal details)
    return new Response(
      JSON.stringify({ error: "Failed to send your message. Please try again later." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
