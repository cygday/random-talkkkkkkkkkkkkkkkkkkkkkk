streamURL={localStream.toURL()}
          style={{ flex: 1 }}
        />
      )}

      {remoteStream && (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={{ flex: 1 }}
        />
      )}

      <TouchableOpacity
        onPress={startCall}
      >
        <Text>Start Call</Text>
      </TouchableOpacity>

    </View>
  );
}
