<?php

require_once('config.php');

// Returns either a user ID or a cookie ID (for anonymous)
function get_viewer_id() {
  list($id, $is_user) = get_viewer_info();
  return $id;
}

// True if viewer is a registered user; false otherwise
function user_logged_in() {
  list($id, $is_user) = get_viewer_info();
  return $is_user;
}

// See init_cookie return
function get_viewer_info() {
  static $viewer_info = null;
  if ($viewer_info === null) {
    $viewer_info = init_cookie();
  }
  return $viewer_info;
}

// Returns array(
//   int: either a user ID or a cookie ID (for anonymous),
//   bool: whether or not the viewer is a user
// )
function init_cookie() {
  global $conn, $cookie_lifetime;

  if (!isset($_COOKIE['user'])) {
    return array(init_anonymous_cookie(), false);
  }
  $cookie_hash = $conn->real_escape_string($_COOKIE['user']);
  $result = $conn->query(
    "SELECT id, user, last_update FROM cookies ".
      "WHERE hash = UNHEX('$cookie_hash') AND user IS NOT NULL"
  );
  $cookie_row = $result->fetch_assoc();
  if (!$cookie_row) {
    delete_cookie('user');
    return array(init_anonymous_cookie(), false);
  }

  $time = round(microtime(true) * 1000); // in milliseconds
  $cookie_id = $cookie_row['id'];
  if ($cookie_row['last_update'] + $cookie_lifetime * 1000 < $time) {
    // Cookie is expired. Delete it...
    delete_cookie('user');
    $conn->query("DELETE FROM cookies WHERE id = $cookie_id");
    $conn->query("DELETE FROM ids WHERE id = $cookie_id");
    return array(init_anonymous_cookie(), false);
  }

  $conn->query(
    "UPDATE cookies SET last_update = $time WHERE id = $cookie_id"
  );

  add_cookie('user', $cookie_hash, $time);
  return array((int)$cookie_row['user'], true);
}

// Returns cookie ID
function init_anonymous_cookie() {
  global $conn;

  list($cookie_id, $cookie_hash) = get_anonymous_cookie();
  $time = round(microtime(true) * 1000); // in milliseconds

  if ($cookie_id) {
    $conn->query(
      "UPDATE cookies SET last_update = $time WHERE id = $cookie_id"
    );
  } else {
    $cookie_hash = hash('sha256', openssl_random_pseudo_bytes(32));
    $conn->query("INSERT INTO ids(table_name) VALUES('cookies')");
    $cookie_id = $conn->insert_id;
    $conn->query(
      "INSERT INTO cookies(id, hash, user, creation_time, last_update) ".
        "VALUES ($cookie_id, UNHEX('$cookie_hash'), NULL, $time, $time)"
    );
  }

  add_cookie('anonymous', $cookie_hash, $time);

  return $cookie_id;
}

// Creates a new user cookie and merges with any existing anonymous cookie
function create_user_cookie($user_id) {
  global $conn;

  $cookie_hash = hash('sha256', openssl_random_pseudo_bytes(32));
  $conn->query("INSERT INTO ids(table_name) VALUES('cookies')");
  $cookie_id = $conn->insert_id;
  $time = round(microtime(true) * 1000); // in milliseconds
  $conn->query(
    "INSERT INTO cookies(id, hash, user, creation_time, last_update) ".
      "VALUES ($cookie_id, UNHEX('$cookie_hash'), $user_id, $time, $time)"
  );
  add_cookie('user', $cookie_hash, $time);

  // We can kill the anonymous cookie now
  // We want to do this regardless of get_anonymous_cookie since that function can
  // return null when there is a cookie on the client
  delete_cookie('anonymous');
  list($anonymous_cookie_id, $_) = get_anonymous_cookie();
  if (!$anonymous_cookie_id) {
    return;
  }

  // Now we will move the anonymous cookie's memberships to the logged in user
  // MySQL can't handle constraint violations on UPDATE, so need to pull all the
  // membership rows to PHP, delete them, and then recreate them :(
  $result = $conn->query(
    "SELECT squad, last_view FROM subscriptions ".
      "WHERE subscriber = $anonymous_cookie_id"
  );
  $new_rows = array();
  while ($row = $result->fetch_assoc()) {
    $new_rows[] = "(".$row['squad'].", ".$user_id.", ".$row['last_view'].")";
  }
  if ($new_rows) {
    $conn->query(
      "INSERT INTO subscriptions(squad, subscriber, last_view) ".
        "VALUES ".implode(', ', $new_rows)." ".
        "ON DUPLICATE KEY ".
        "UPDATE last_view = GREATEST(VALUES(last_view), last_view)"
    );
    $conn->query(
      "DELETE FROM subscriptions WHERE subscriber = $anonymous_cookie_id"
    );
  }
  $conn->query("DELETE FROM cookies WHERE id = $anonymous_cookie_id");
  $conn->query("DELETE FROM ids WHERE id = $anonymous_cookie_id");
}

// Returns array(int: cookie_id, string: cookie_hash)
// If no anonymous cookie, returns (null, null)
function get_anonymous_cookie() {
  global $conn, $cookie_lifetime;

  // First, let's see if we already have a valid cookie
  if (!isset($_COOKIE['anonymous'])) {
    return array(null, null);
  }

  // We already have a cookie! Let's look up the session
  $cookie_hash = $conn->real_escape_string($_COOKIE['anonymous']);
  $result = $conn->query(
    "SELECT id, last_update FROM cookies ".
      "WHERE hash = UNHEX('$cookie_hash') AND user IS NULL"
  );

  $cookie_row = $result->fetch_assoc();
  if (!$cookie_row) {
    return array(null, null);
  }

  // Is the cookie expired?
  $time = round(microtime(true) * 1000); // in milliseconds
  if ($cookie_row['last_update'] + $cookie_lifetime * 1000 < $time) {
    $old_cookie_id = $cookie_row['id'];
    $conn->query("DELETE FROM cookies WHERE id = $old_cookie_id");
    $conn->query("DELETE FROM ids WHERE id = $old_cookie_id");
    $conn->query(
      "DELETE FROM subscriptions WHERE subscriber = $old_cookie_id"
    );
    return array(null, null);
  }

  return array((int)$cookie_row['id'], $cookie_hash);
}

// $current_time in milliseconds
function add_cookie($name, $value, $current_time) {
  global $cookie_lifetime;
  set_cookie($name, $value, intval($current_time / 1000) + $cookie_lifetime);
}

function delete_cookie($name) {
  set_cookie($name, '', time() - 3600);
}

// $expiration_time in seconds
function set_cookie($name, $value, $expiration_time) {
  global $base_url, $https;

  $path = parse_url($base_url, PHP_URL_PATH);
  $domain = parse_url($base_url, PHP_URL_HOST);
  $domain = preg_replace("/^www\.(.*)/", "$1", $domain);

  setcookie(
    $name,
    $value,
    $expiration_time,
    $path,
    $domain,
    $https, // HTTPS only
    true // no JS access
  );
}
