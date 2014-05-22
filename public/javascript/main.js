// Initial code by Borui Wang, updated by Graham Roth
// For CS247, Spring 2014

var ephemeral=true; //flag to turn ephemerality on and off for testing purposes
var player; //youtube player object 
var videoID; //youtube id for the youtube video
var mediaRecorder; //object that handles video recording
var finished=false; //flag that shows whether video is finished playing
var video_length=2000; //length that recording should be
var pause = video_length+1000; //pause length after recording starts till video should be savedc
var time=3; //time displayed on countdown on top of webcam 
var library ={}; //structure to store all of the reaction videos 
var username; //username of current viewer
var cur_video_blob; //most recently recorded blob 
var purpose_blob;
var fb_instance_mainVid; //fire base instance containing the main video 
var fb_instance_reactions; //firebase instance for the reaction videos 
//var sentTo=[]; //arry of people to send the video to (used by email feature)
var cameraOn = false; //keeps track of whether the user has enabled the webcam
var ownerName;
var reactionsCount = 0; //number of reaction videos displayed
var reactionLimit = 3; //maximum number of reaction videos displayed

var current_user_is_owner = false; //flag that says whether the current user is the owner



  cur_video_blob = null;
  var fb_instance;
  purpose_blob = null;
    var user;


  $(document).ready(function(){
    connect_to_chat_firebase();
  });


  function connect_to_chat_firebase(){
    /* Include your Firebase link here!*/
    fb_instance = new Firebase("https://youtube-react.firebaseio.com");

    // generate new chatroom id or use existing id
    var url_segments = document.location.href.split("/#");
    if(url_segments[1]){
      fb_chat_room_id = url_segments[1];
    }else{
      fb_chat_room_id = Math.random().toString(36).substring(7);
    }
    //display_msg({m:"Share this url with your friend to join this chat: "+ document.location.origin+"/#"+fb_chat_room_id,c:"red"})

    // set up variables to access firebase data structure
    var fb_new_chat_room = fb_instance.child('chatrooms').child(fb_chat_room_id);
    var fb_instance_users = fb_new_chat_room.child('users');
    var fb_instance_stream = fb_new_chat_room.child('stream');
    var fb_owner = fb_new_chat_room.child('owner');
    fb_instance_mainVid = fb_new_chat_room.child('mainVid');
    fb_instance_reactions = fb_new_chat_room.child('reactions');
    var my_color = "#"+((1<<24)*Math.random()|0).toString(16);

    // listen to events
    window.location.href=document.location.origin+"/#"+fb_chat_room_id;
  
    fb_instance_stream.on("child_added",function(snapshot){
      display_msg(snapshot.val());
    });



    //display reactions that have already been recorded if current user is owner
    fb_instance_reactions.on("child_added", function(snapshot){
        appendVideo(snapshot.val().name, snapshot.val().v);
    });

    // block until username is answered
    username = window.prompt("Welcome to youtube record where you can see your friend's reactions to youtube videos! Enter your name to begin and make sure to enable the camera at the top of your screen");
    if(!username){
      username = "anonymous"+Math.floor(Math.random()*1111);
    }

    //add user as owner if there is no owner
    fb_owner.once('value', function(snapshot) {
      if(snapshot.val() === null) {
        //There's no owner, so add one
        fb_owner.set({ name: username});
      }
    });

    // check if user was the one who created the room
    fb_owner.on('value', function(snapshot) {
      var owner_info = snapshot.val();
      ownerName = owner_info.name;
      if(ownerName == username) {
        //current user is the owner of the room, so set global variable
        current_user_is_owner = true; 
       // alert('User is the owner.');
       document.getElementById("reactions").style.display="block";
       document.getElementById("friend_guide").style.display="none";
       document.getElementById("footer").style.display="none";
      } else {
        //alert('User is NOT the owner');
        connect_webcam();
        document.getElementById("reactions").style.display="none";
        document.getElementById("owner_guide").style.display="none";
      }
    });

        //display video if one is already associated with the room
    fb_instance_mainVid.on("child_added",function(snapshot){
      addVideo(snapshot.val().url);
      if(current_user_is_owner){
        console.log("should display share div");
        displayShareDiv();
      }
    });

    fb_instance_users.push({ name: username,c: my_color});
    $("#waiting").remove();


    // scroll to bottom in case there is already content
    //scroll_to_bottom(1300);
  }

  // creates a message node and appends it to the conversation
  function display_msg(data){
    $("#conversation").append("<div class='msg' style='color:"+data.c+"'>"+data.m+"</div>");
    if(data.v){
      // for video element
      var video = document.createElement("video");
      video.autoplay = true;
      video.controls = false; // optional
      video.loop = true;
      video.width = 120;

      var source = document.createElement("source");
      source.src =  URL.createObjectURL(base64_to_blob(data.v));
      source.type =  "video/webm";

      video.appendChild(source);

      // for gif instead, use this code below and change mediaRecorder.mimeType in onMediaSuccess below
      // var video = document.createElement("img");
      // video.src = URL.createObjectURL(base64_to_blob(data.v));

      document.getElementById("conversation").appendChild(video);
    }
  }

  function scroll_to_bottom(wait_time){
    // scroll to bottom of div
    setTimeout(function(){
      $("html, body").animate({ scrollTop: $(document).height() }, 200);
    },wait_time);
  }

  function connect_webcam(){
    // we're only recording video, not audio
    var mediaConstraints = {
      video: true,
      audio: false
    };

    // callback for when we get video stream from user.
    var onMediaSuccess = function(stream) {
      cameraOn=true;
      // create video element, attach webcam stream to video element
      var video_width= 160;
      var video_height= 120;
      var webcam_stream = document.getElementById('webcam_stream');
      var video = document.createElement('video');
      webcam_stream.innerHTML = "";
      // adds these properties to the video
      video = mergeProps(video, {
          controls: false,
          width: video_width,
          height: video_height,
          src: URL.createObjectURL(stream)
      });
      video.play();
      webcam_stream.appendChild(video);

      // add recording message
      var rm_div = document.createElement('div');
      rm_div.setAttribute("id", "record_message");
      rm_div.appendChild(document.createTextNode("Recording..."));
      webcam_stream.appendChild(rm_div);

      // counter
      var time = 0;
      var second_counter = document.getElementById('second_counter');
      var second_counter_update = setInterval(function(){
        second_counter.innerHTML = time++;
      },1000);

      // now record stream in 5 seconds interval
      var video_container = document.getElementById('video_container');
      mediaRecorder = new MediaStreamRecorder(stream);
      var index = 1;

      mediaRecorder.mimeType = 'video/webm';
      // mediaRecorder.mimeType = 'image/gif';
      // make recorded media smaller to save some traffic (80 * 60 pixels, 3*24 frames)
      mediaRecorder.video_width = video_width/2;
      mediaRecorder.video_height = video_height/2;

      mediaRecorder.ondataavailable = function (blob) {
          //console.log("new data available!");
          video_container.innerHTML = "";

          // convert data into base 64 blocks
          blob_to_base64(blob,function(b64_data){
            cur_video_blob = b64_data;
          });
      };
      //setInterval( function() {
        //mediaRecorder.stop();
        //mediaRecorder.start(3000);
      //}, 3000 );
      console.log("connect to media stream!");
    }

    // callback if there is an error when we try and get the video stream
    var onMediaError = function(e) {
      console.error('media error', e);
    }

    // get video stream from user. see https://github.com/streamproc/MediaStreamRecorder
    navigator.getUserMedia(mediaConstraints, onMediaSuccess, onMediaError);
  }

  // check to see if a message qualifies to be replaced with video.
  var has_emotions = function(msg){
    var options = ["lol",":)",":("];
    for(var i=0;i<options.length;i++){
      if(msg.indexOf(options[i])!= -1){
        return true;
      }
    }
    return false;
  }


  // some handy methods for converting blob to base 64 and vice versa
  // for performance bench mark, please refer to http://jsperf.com/blob-base64-conversion/5
  // note useing String.fromCharCode.apply can cause callstack error
  var blob_to_base64 = function(blob, callback) {
    var reader = new FileReader();
    reader.onload = function() {
      var dataUrl = reader.result;
      var base64 = dataUrl.split(',')[1];
      callback(base64);
    };
    reader.readAsDataURL(blob);
  };

  var base64_to_blob = function(base64) {
    var binary = atob(base64);
    var len = binary.length;
    var buffer = new ArrayBuffer(len);
    var view = new Uint8Array(buffer);
    for (var i = 0; i < len; i++) {
      view[i] = binary.charCodeAt(i);
    }
    var blob = new Blob([view]);
    return blob;
  };


/*
* Called when the user uploads a video url.
* Calls the proper functions to display the video and to display the sharing information
*/
function urlAdded(){
   console.log("form submitted");
   var vidUrl=document.getElementById("url").value;
   vidUrl=vidUrl.match("v=[0-9A-Za-z]*");
   vidUrl=vidUrl[0].replace("v=", "");
   addVideo(vidUrl);
   fb_instance_mainVid.push({ url: vidUrl});
   displayShareDiv();
}

/*
* Displays the div with information about how to share the video
* Called once a video is uploaded
*/
function displayShareDiv(){
   var link=document.location.origin+"/#"+fb_chat_room_id;
   document.getElementById("shareLink").innerHTML=link;
   document.getElementById("shareLink").href=link;
  // document.getElementById("invites").value="";
   document.getElementById("sendInvites").style.display="block";
}

/*
* Adds the youtube video selected by the user to the page
*/
  function addVideo(vidUrl){
    tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    player;
    videoID=vidUrl;
    done = false;
    //document.getElementById("playVideo").innerHTML="<iframe title=\"Youtube video player\" src=\""+vidUrl+"\"></iframe>";
  }

/*
* youtube api function called when the api frame is ready
*/
   function onYouTubeIframeAPIReady() {
        player = new YT.Player('playVideo', {
          //height: '390',
          //width: '640',
          videoId: videoID,
          events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
          }
        });
      }

/*
* Youtube api function called when the video is loaded
*/
  function onPlayerReady(event) {
        //event.target.playVideo();
      }

/*
* youtube api function called whenever the state of the player changes (eg play/pause)
* if the video starts playing this function causes the reaction videos to start playing if the user is the owner
* If the user is the owner it calls the function to begin recording
*/
  function onPlayerStateChange(event) {
    //if video starts playing
    console.log("event" + YT.PlayerState );
        if (event.data == YT.PlayerState.PLAYING) {
          if(!cameraOn && !current_user_is_owner){
            player.stopVideo();
            player.seekTo(0, false);
            window.prompt("Please turn the camera on at the top of the screen before you can watch the video. "+ownerName+" wants to see your reaction!");
            //player.playVideo();
            return;
          }
          console.log("am i getting here?");
          video_length=player.getDuration()*1000;
          pause = video_length+1000;
          console.log("started playing video");
          if(!current_user_is_owner){
            recordWatcher();
          }
          if(current_user_is_owner){
            var vids= document.getElementsByClassName("reactionVid");
            var currentTime = player.getCurrentTime();
            for(var i=0; i<vids.length; i++){
               vids[i].currentTime=currentTime;
               vids[i].play();
               vids[i].className="reactionVid viewed"
            }
          }
        }
        //if video finishes playing
        if (event.data === 0 && ephemeral) {
          console.log("end");
          var vidsViewed= document.getElementsByClassName("viewed");
           for(var i=0; i<vidsViewed.length; i++){
               vidsViewed[i].style.display="none";
            }
             fb_instance_reactions.remove();
        }
      }


  function stopVideo() {
        player.stopVideo();
      }

  function playVideo() {
      player.playVideo();
  }

/*
* called once the viewer presses play on a video 
* calls the function that triggers the recording and saves the video after the 
* length of the video has passed
*/
  function recordWatcher(){
        console.log("recording watcher");
        record(mediaRecorder);
        setTimeout(function(){saveVideo(username)},pause);
      }

/*
* This function is called once a reaction video is finished recording
* It saves the video to firebase
*/
  function saveVideo(string){
      console.log("saving video");
      library[string]=cur_video_blob;
      var url = URL.createObjectURL(base64_to_blob(library[string]));
      //appendVideo(username, url);
      console.log("appending video");
      fb_instance_reactions.push({name: username, v:cur_video_blob})
    }

/*
* This function adds a reaction video to the page
* It takes a url to a video and a username to display beneath the video
*/
    function appendVideo(name, url){
      if (reactionsCount >= reactionLimit) {
        return;
      }
      var url = URL.createObjectURL(base64_to_blob(url));
      console.log("url: "+url);
      console.log("appending video");
      var video = document.createElement("video");
      video.className="reactionVid";
      var container = document.createElement("div");
      container.className="reactionDiv"
      video.autoplay = false;
      video.controls = false; // optional
      video.loop = false;
      video.width = 360;
      var source = document.createElement("source");
      source.src =  url;
      console.log("library "+source.src);
      source.type =  "video/webm";
      video.title=name;
      video.appendChild(source);
      var title = document.createElement("h2");
      title.innerText=name;
      container.appendChild(title);

      //make clicking reaction video start youtube video
      video.onclick = playVideo;
      container.appendChild(video);

      document.getElementById("reactions").appendChild(container);
      reactionsCount += 1;
    }

/*
* This is the function that gets called when the viewer starts watching the video
* It starts a recording of the same length as the video and displays the web cam view
*/
  var record = function(mediaRecorder){
    console.log("recording");
     time=3;
     document.getElementById("second_counter").style.display="block";
     document.getElementById("webcam_stream").style.display="block";
    console.log("video_length: "+video_length);
     mediaRecorder.start(video_length);
     setTimeout(function(){document.getElementById("webcam_stream").style.display="none"}, pause);
     setTimeout(function(){document.getElementById("second_counter").style.display="none"}, pause);  
  }


/*
//This is the email feature from the previous version
  function sendInvites(){
    var contacts = document.getElementById("invites").value;
    contacts=contacts.replace(";",",");
    contacts=contacts.replace(", ",",");
    contacts=contacts.replace(" ",",");
    sentTo.push(contacts.split(","));
    //contacts=contacts.split(",");
    console.log(contacts);
    //for(var i=0; i<contacts.length; i++){
     // var email = contacts[i];
     var link=document.location.origin+"/#"+fb_chat_room_id;
     document.location.href="mailto:"+contacts+"?subject=Youtube Vid&body=I want to share a video with you. Check it out at this link: "+link;
    //}
    document.getElementById("sendInvites").style.display="none";
    document.getElementById("sendMore").style.display="block";
  }*/
