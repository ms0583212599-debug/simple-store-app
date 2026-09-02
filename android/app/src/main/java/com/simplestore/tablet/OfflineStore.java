package com.simplestore.tablet;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.UUID;

final class OfflineStore {
    private static final String PREFS = "simple_store_offline";
    private static final String CATEGORIES = "categories";
    private static final String PRODUCTS = "products";
    private static final String SUPPLIERS = "suppliers";
    private static final String QUEUE = "pending_operations";

    private final Context context;
    private final SharedPreferences prefs;

    OfflineStore(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            Network network = cm.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities caps = cm.getNetworkCapabilities(network);
            return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } catch (Exception ignored) {
            return false;
        }
    }

    void watchConnection(Runnable onConnected) {
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkRequest request = new NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build();
            cm.registerNetworkCallback(request, new ConnectivityManager.NetworkCallback() {
                @Override public void onAvailable(Network network) { onConnected.run(); }
            });
        } catch (Exception ignored) {}
    }

    synchronized void saveCatalog(JSONArray categories, JSONArray products) {
        prefs.edit().putString(CATEGORIES, categories.toString())
                .putString(PRODUCTS, products.toString()).apply();
    }

    synchronized JSONArray categories() { return read(CATEGORIES); }
    synchronized JSONArray products() { return read(PRODUCTS); }
    synchronized void saveSuppliers(JSONArray suppliers) { prefs.edit().putString(SUPPLIERS, suppliers.toString()).apply(); }
    synchronized JSONArray suppliers() { return read(SUPPLIERS); }

    synchronized int pendingCount() { return read(QUEUE).length(); }
    synchronized JSONArray pending() { return read(QUEUE); }
    synchronized void replacePending(JSONArray value) { prefs.edit().putString(QUEUE, value.toString()).commit(); }

    synchronized JSONObject enqueue(String method, String path, JSONObject originalBody, boolean admin) throws Exception {
        JSONObject body = originalBody == null ? new JSONObject() : new JSONObject(originalBody.toString());
        if ("POST".equals(method) && (path.startsWith("/rest/v1/products") ||
                path.startsWith("/rest/v1/categories") || path.startsWith("/rest/v1/suppliers")) && !body.has("id")) {
            body.put("id", UUID.randomUUID().toString());
        }
        JSONObject op = new JSONObject();
        op.put("id", UUID.randomUUID().toString());
        op.put("method", method);
        op.put("path", path);
        op.put("body", body);
        op.put("admin", admin);
        op.put("created_at", System.currentTimeMillis());
        JSONArray queue = read(QUEUE);
        queue.put(op);
        replacePending(queue);
        apply(method, path, body);
        return body;
    }

    private void apply(String method, String path, JSONObject body) throws Exception {
        if (path.startsWith("/rest/v1/products")) {
            JSONArray rows = read(PRODUCTS);
            if ("POST".equals(method)) rows.put(new JSONObject(body.toString()));
            else patchByQuery(rows, path, body);
            prefs.edit().putString(PRODUCTS, rows.toString()).commit();
        } else if (path.startsWith("/rest/v1/categories")) {
            JSONArray rows = read(CATEGORIES);
            if ("POST".equals(method)) rows.put(new JSONObject(body.toString()));
            else patchByQuery(rows, path, body);
            prefs.edit().putString(CATEGORIES, rows.toString()).commit();
        } else if (path.startsWith("/rest/v1/suppliers")) {
            JSONArray rows = read(SUPPLIERS);
            if ("POST".equals(method)) rows.put(new JSONObject(body.toString()));
            else if ("DELETE".equals(method)) removeByQuery(rows, path);
            else patchByQuery(rows, path, body);
            prefs.edit().putString(SUPPLIERS, rows.toString()).commit();
        } else if (path.contains("/rpc/adjust_stock")) {
            JSONArray rows = read(PRODUCTS);
            String id = body.optString("p_product_id");
            int change = body.optInt("p_change_qty");
            for (int i=0;i<rows.length();i++) {
                JSONObject row=rows.getJSONObject(i);
                if (id.equals(row.optString("id"))) row.put("stock_quantity", row.optInt("stock_quantity")+change);
            }
            prefs.edit().putString(PRODUCTS, rows.toString()).commit();
        } else if (path.contains("/rpc/archive_product")) {
            JSONArray rows=read(PRODUCTS); removeById(rows, body.optString("p_product_id"));
            prefs.edit().putString(PRODUCTS, rows.toString()).commit();
        } else if (path.contains("/rpc/create_purchase")) {
            JSONArray rows=read(PRODUCTS); JSONArray items=body.optJSONArray("p_items");
            if(items!=null) for(int j=0;j<items.length();j++){
                JSONObject item=items.getJSONObject(j); String id=item.optString("product_id");
                for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);if(id.equals(row.optString("id"))){
                    row.put("stock_quantity",row.optInt("stock_quantity")+item.optInt("quantity"));
                    if(item.has("sale_price"))row.put("price",item.optDouble("sale_price"));
                }}
            }
            prefs.edit().putString(PRODUCTS, rows.toString()).commit();
        }
    }

    private void patchByQuery(JSONArray rows,String path,JSONObject body)throws Exception{
        String id=queryId(path);
        for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);if(id.equals(row.optString("id"))){
            JSONArray names=body.names();if(names!=null)for(int j=0;j<names.length();j++){String k=names.getString(j);row.put(k,body.get(k));}
        }}
    }
    private void removeByQuery(JSONArray rows,String path)throws Exception{removeById(rows,queryId(path));}
    private void removeById(JSONArray rows,String id)throws Exception{
        for(int i=rows.length()-1;i>=0;i--)if(id.equals(rows.getJSONObject(i).optString("id")))rows.remove(i);
    }
    private String queryId(String path){
        int i=path.indexOf("id=eq.");if(i<0)return "";String s=path.substring(i+6);int amp=s.indexOf('&');return amp<0?s:s.substring(0,amp);
    }
    private JSONArray read(String key){
        try{return new JSONArray(prefs.getString(key,"[]"));}catch(Exception ignored){return new JSONArray();}
    }
}
