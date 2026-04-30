import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://czerhuxipjxgodflizii.supabase.co"
const supabasePublishableKey = "sb_publishable_O2rkOtqjAObFtC7j6lLFjg_eX9G5j_Y"

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

