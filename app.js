require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

const url = 'https://www.suplementoscolombia.co/';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    persistSession: false,
  });

async function fetchData() {
  const response = await axios.get(url);
  const html = response.data;
  const $ = cheerio.load(html);

  const linkslist = [];
  $('.submenu li a').each(function () {
    const link = $(this).attr('href');
    linkslist.push({ link: link });
  });

  const linkslist2 = [];
  for (const element of linkslist) {
    const productUrl2 = element.link;
    const productResponse2 = await axios.get(productUrl2);
    const productHtml2 = productResponse2.data;
    const product2$ = cheerio.load(productHtml2);
    product2$('.page-link').each(function () {
      const link = $(this).attr('href');
      linkslist2.push({ link: link });
    });
  }

  const filteredLinkslist2 = linkslist2.filter(item => item.link !== undefined);
  
  const linkslist3 = linkslist.concat(filteredLinkslist2);

 

  const productlist = [];
  for (const element of linkslist3) {
    const productUrl = element.link;
    const productResponse = await axios.get(productUrl);
    const productHtml = productResponse.data;
    const product$ = cheerio.load(productHtml);

    product$('.grid_item').each(function () {
      const name = product$(this).find('h3').text();
      const price = product$(this).find('span.new_price').text();

      productlist.push({
        name: name,
        price: price,
      });
    });
  }

  return productlist;
}



async function sendDataToSupabase() {
  try {
    const data = await fetchData();

    const { data: insertedData, error } = await supabase
      .from('Price')
      .insert(data);

    if (error) {
      console.error('Error inserting data:', error);
    } else {
      console.log('Data inserted successfully:', insertedData);
    }
  } catch (error) {
    console.error('Error sending data to Supabase:', error);
  }
}

// Call the function to send data to Supabase
sendDataToSupabase();

async function fetchData2(productlist) {
  const updatedProductData = await Promise.all(
    productlist.map(async (product) => {
      const previousData = await supabase
        .from('PriceDifference')
        .select('price')
        .eq('name', product.name)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let priceDifference = null;
      if (previousData && previousData.price) {
        const previousPrice = parseFloat(previousData.price.replace('$', ''));
        const currentPrice = parseFloat(product.price.replace('$', ''));
        priceDifference = currentPrice - previousPrice;
      }

      return {
        name: product.name,
        price: product.price,
        price_difference: priceDifference,
      };
    })
  );

  return updatedProductData;
}

async function sendDataToSupabase2() {
  try {
    const data = await fetchData();
    const updatedData = await fetchData2(data);

    const { data: insertedData, error } = await supabase
      .from('PriceDifference')
      .insert(updatedData);

    if (error) {
      console.error('Error inserting data:', error);
    } else {
      console.log('Data inserted successfully:', insertedData);
    }
  } catch (error) {
    console.error('Error sending data to Supabase:', error);
  }
}

// Call the function to send data to Supabase
sendDataToSupabase2();
setInterval(sendDataToSupabase, 24 * 60 * 60 * 1000)
setInterval(sendDataToSupabase2, 24 * 60 * 60 * 1000)