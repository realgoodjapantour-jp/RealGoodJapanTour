import { NextRequest, NextResponse } from 'next/server'
import { emailApi } from '@/lib/api'
import { createSupabaseServerClientApp } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = await createSupabaseServerClientApp()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: bookingNumber, error: bookingNumberError } = await supabase.rpc('generate_booking_number')
    if (bookingNumberError) {
      return NextResponse.json({ error: bookingNumberError.message }, { status: 500 })
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        ...body,
        user_id: user.id,
        booking_number: bookingNumber,
      })
      .select('*, tour:tours(*)')
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: bookingError?.message || 'Failed to create booking' }, { status: 500 })
    }

    // Send confirmation email
    await emailApi.sendBookingConfirmation(booking)

    return NextResponse.json(booking)
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClientApp()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*, tour:tours(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (bookingsError) {
      return NextResponse.json({ error: bookingsError.message }, { status: 500 })
    }

    return NextResponse.json(bookings || [])
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}
